"""
StandPoint Auth — Supabase-backed email/password authentication.

Provides POST /api/auth/signup, POST /api/auth/login, and a
get_current_user dependency that verifies Bearer tokens via
Supabase /auth/v1/user.

All responses are strictly validated. No raw provider errors,
secrets, or input values are echoed to the client.
"""

import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

_SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
_SUPABASE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")

_TIMEOUT = 10.0  # seconds

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class AuthRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str


class AuthResponse(BaseModel):
    access_token: str
    user: UserOut


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_headers() -> dict[str, str]:
    """Return headers required by Supabase Auth REST API."""
    return {
        "apikey": _SUPABASE_KEY,
        "Content-Type": "application/json",
    }


def _extract_user(raw: dict) -> dict:
    """Extract and validate user fields from a Supabase auth response.

    Supabase may return user at the top level or nested under 'user'.
    Both id and email must be non-empty strings.
    Returns a normalised {"id": str, "email": str} dict.
    Raises ValueError on any validation failure.
    """
    user_data = raw.get("user") if isinstance(raw.get("user"), dict) else raw

    user_id = user_data.get("id")
    user_email = user_data.get("email")

    if not isinstance(user_id, str) or not user_id:
        raise ValueError("Invalid user id")
    if not isinstance(user_email, str) or not user_email:
        raise ValueError("Invalid user email")

    return {"id": user_id, "email": user_email}


def _extract_access_token(raw: dict) -> str:
    """Extract and validate access_token from a Supabase auth response.

    Must be a non-empty string. Raises ValueError on failure.
    """
    token = raw.get("access_token")
    if not isinstance(token, str) or not token:
        raise ValueError("Invalid access token")
    return token


def _provider_failure(detail: str = "Authentication service unavailable."):
    """Return a safe 503 without leaking provider internals."""
    return JSONResponse(
        status_code=503,
        content={"detail": detail},
    )


def _is_invalid_credentials(raw: dict) -> bool:
    """Detect whether a Supabase error response indicates invalid credentials.

    Checks for Supabase's known patterns:
    - error field equals 'invalid_grant'
    - error_description / msg / message contains 'invalid' and 'credential'
      (case-insensitive)

    Returns False for anything that does not clearly match, so callers
    fall through to the safe 503 path.
    """
    if not isinstance(raw, dict):
        return False

    err = raw.get("error")
    if isinstance(err, str) and err.lower() == "invalid_grant":
        return True

    for key in ("error_description", "msg", "message"):
        val = raw.get(key)
        if isinstance(val, str):
            lower = val.lower()
            if "invalid" in lower and "credential" in lower:
                return True

    return False


# ---------------------------------------------------------------------------
# Public dependency: get_current_user
# ---------------------------------------------------------------------------


async def get_current_user(request: Request) -> dict:
    """FastAPI dependency that verifies a Bearer token via Supabase.

    Returns {"id": str, "email": str} on success.
    Raises 401 for missing/invalid tokens, 503 for provider outages.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header.")

    token = auth_header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header.")

    if not _SUPABASE_URL or not _SUPABASE_KEY:
        raise HTTPException(status_code=503, detail="Authentication service unavailable.")

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.get(
                f"{_SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": _SUPABASE_KEY,
                    "Authorization": f"Bearer {token}",
                },
            )
    except (httpx.HTTPError, httpx.TimeoutException):
        raise HTTPException(status_code=503, detail="Authentication service unavailable.")

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Authentication service unavailable.")

    try:
        raw = resp.json()
        user = _extract_user(raw)
    except Exception:
        raise HTTPException(status_code=503, detail="Authentication service unavailable.")

    return user


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/signup")
async def signup(body: AuthRequest):
    """Create a new account via Supabase Auth.

    Returns {access_token, user: {id, email}} on success.
    Duplicate signups return a neutral 503 message.
    """
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        return _provider_failure()

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                f"{_SUPABASE_URL}/auth/v1/signup",
                headers=_safe_headers(),
                json={"email": body.email, "password": body.password},
            )
    except (httpx.HTTPError, httpx.TimeoutException):
        return _provider_failure()

    if resp.status_code not in (200, 201):
        return _provider_failure()

    try:
        raw = resp.json()
    except Exception:
        return _provider_failure()

    # Check for duplicate / error conditions in the response body
    if raw.get("error") or raw.get("msg"):
        return _provider_failure("Unable to create account. Please try again.")

    # Strict validation: must have valid access_token AND valid user
    try:
        token = _extract_access_token(raw)
        user = _extract_user(raw)
    except ValueError:
        return _provider_failure()

    return {"access_token": token, "user": user}


@router.post("/login")
async def login(body: AuthRequest):
    """Authenticate with email and password via Supabase Auth.

    Returns {access_token, user: {id, email}} on success.
    """
    if not _SUPABASE_URL or not _SUPABASE_KEY:
        return _provider_failure()

    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            resp = client.post(
                f"{_SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers=_safe_headers(),
                json={"email": body.email, "password": body.password},
            )
    except (httpx.HTTPError, httpx.TimeoutException):
        return _provider_failure()

    if resp.status_code != 200:
        # Try to distinguish invalid credentials from provider outages
        try:
            raw = resp.json()
        except Exception:
            raw = {}

        if resp.status_code == 400 and _is_invalid_credentials(raw):
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid email or password."},
            )

        return _provider_failure()

    try:
        raw = resp.json()
    except Exception:
        return _provider_failure()

    # Strict validation
    try:
        token = _extract_access_token(raw)
        user = _extract_user(raw)
    except ValueError:
        return _provider_failure()

    return {"access_token": token, "user": user}