"""Tests for authentication endpoints: POST /api/auth/signup, POST /api/auth/login.

All Supabase calls are mocked via httpx.Client patching.
Includes sentinel-secret no-leak tests.
"""

import httpx
import pytest
from unittest.mock import MagicMock, patch
from httpx import ASGITransport, AsyncClient

from backend.api.index import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def anyio_backend():
    return "asyncio"


# Sentinel secret for no-leak tests
_SENTINEL_SECRET = "sb-secret-s3nt1n3l-v4lu3"
_SENTINEL_URL = "https://test-project.supabase.co"


def _env_vars():
    """Return a dict of env vars for Supabase config."""
    return {
        "SUPABASE_URL": _SENTINEL_URL,
        "SUPABASE_PUBLISHABLE_KEY": _SENTINEL_SECRET,
    }


def _success_signup_response():
    """Return a realistic Supabase signup success payload."""
    return {
        "access_token": "eyJhbGciOiJIUzI1NiJ9.valid.token",
        "token_type": "bearer",
        "expires_in": 3600,
        "refresh_token": "should-not-be-returned",
        "user": {
            "id": "abc-123-def",
            "email": "user@example.com",
            "aud": "authenticated",
            "role": "authenticated",
        },
    }


def _success_login_response():
    """Return a realistic Supabase login success payload."""
    return {
        "access_token": "eyJhbGciOiJIUzI1NiJ9.login.token",
        "token_type": "bearer",
        "expires_in": 3600,
        "refresh_token": "should-not-be-returned",
        "user": {
            "id": "abc-123-def",
            "email": "user@example.com",
            "aud": "authenticated",
            "role": "authenticated",
        },
    }


def _make_httpx_response(status_code, json_data):
    """Create a mock httpx.Response."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data
    return resp


# ---------------------------------------------------------------------------
# Validation tests (no Supabase call needed)
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_login_validation_missing_body():
    """Empty body should return 422 with sanitized message."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", content=b"", headers={"Content-Type": "application/json"})

    assert resp.status_code == 422


@pytest.mark.anyio
async def test_signup_validation_missing_body():
    """Empty body should return 422."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", content=b"", headers={"Content-Type": "application/json"})

    assert resp.status_code == 422


@pytest.mark.anyio
async def test_login_validation_wrong_type_body():
    """Body with wrong types should return 422."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": 123, "password": True})

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login success
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch.dict("os.environ", {"SUPABASE_URL": _SENTINEL_URL, "SUPABASE_PUBLISHABLE_KEY": _SENTINEL_SECRET})
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_login_success(mock_client_cls):
    """Valid credentials should return 200 with access_token and user."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, _success_login_response())
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "user@example.com", "password": "Pass123!"})

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["access_token"], str) and data["access_token"]
    assert data["user"]["id"] == "abc-123-def"
    assert data["user"]["email"] == "user@example.com"
    # Must NOT include refresh_token
    assert "refresh_token" not in data


# ---------------------------------------------------------------------------
# Login failures
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_login_provider_failure(mock_client_cls):
    """Non-credential 400 from Supabase should return 503 (not misclassified)."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(400, {"error": "server_error"})
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong"})

    assert resp.status_code == 503
    assert "unavailable" in resp.json()["detail"].lower()


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_login_wrong_password(mock_client_cls):
    """Supabase invalid_grant should return 401 with safe message."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(400, {
        "error": "invalid_grant",
        "error_description": "Invalid login credentials",
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong"})

    assert resp.status_code == 401
    detail = resp.json()["detail"]
    assert detail == "Invalid email or password."


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_login_wrong_password_no_raw_leak(mock_client_cls):
    """Invalid-credentials response must not leak raw Supabase strings."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(400, {
        "error": "invalid_grant",
        "error_description": "Invalid login credentials",
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "user@example.com", "password": "wrong"})

    body = resp.text
    assert "invalid_grant" not in body
    assert "Invalid login credentials" not in body


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_login_outage_500(mock_client_cls):
    """Supabase 500 should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(500, {"error": "internal_server_error"})
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "user@example.com", "password": "Pass123!"})

    assert resp.status_code == 503


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_login_outage_malformed_body(mock_client_cls):
    """400 with body missing credential keys should return 503 (not 401)."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(400, {"error": "unexpected_error"})
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "user@example.com", "password": "Pass123!"})

    assert resp.status_code == 503


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_login_transport_failure(mock_client_cls):
    """httpx transport error should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.side_effect = httpx.ConnectError("connection refused")
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "user@example.com", "password": "Pass123!"})

    assert resp.status_code == 503


# ---------------------------------------------------------------------------
# Signup success and failures
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_success(mock_client_cls):
    """Valid signup should return 200 with token and user."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, _success_signup_response())
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "new@example.com", "password": "Pass123!"})

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["access_token"], str) and data["access_token"]
    assert data["user"]["id"] == "abc-123-def"
    assert data["user"]["email"] == "user@example.com"


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_duplicate(mock_client_cls):
    """Duplicate signup should return 503 with neutral wording."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, {
        "msg": "User already registered",
        "error": "user_already_exists",
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "dupe@example.com", "password": "Pass123!"})

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert "Unable to create account" in detail
    # Must NOT disclose whether email exists
    assert "already" not in detail.lower()
    assert "exists" not in detail.lower()


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_transport_failure(mock_client_cls):
    """httpx transport error during signup should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.side_effect = httpx.TimeoutException("timed out")
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "new@example.com", "password": "Pass123!"})

    assert resp.status_code == 503


# ---------------------------------------------------------------------------
# Token validation tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_missing_token(mock_client_cls):
    """Signup response without access_token should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, {
        "user": {"id": "abc-123", "email": "u@e.com"},
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "u@e.com", "password": "Pass123!"})

    assert resp.status_code == 503


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_empty_token(mock_client_cls):
    """Signup response with empty access_token should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, {
        "access_token": "",
        "user": {"id": "abc-123", "email": "u@e.com"},
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "u@e.com", "password": "Pass123!"})

    assert resp.status_code == 503


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_numeric_token(mock_client_cls):
    """Signup response with numeric access_token should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, {
        "access_token": 12345,
        "user": {"id": "abc-123", "email": "u@e.com"},
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "u@e.com", "password": "Pass123!"})

    assert resp.status_code == 503


# ---------------------------------------------------------------------------
# Malformed user field tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_malformed_user_missing_id(mock_client_cls):
    """Signup response with user missing id should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, {
        "access_token": "valid-token",
        "user": {"email": "u@e.com"},
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "u@e.com", "password": "Pass123!"})

    assert resp.status_code == 503


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_malformed_user_empty_email(mock_client_cls):
    """Signup response with user empty email should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, {
        "access_token": "valid-token",
        "user": {"id": "abc-123", "email": ""},
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "u@e.com", "password": "Pass123!"})

    assert resp.status_code == 503


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_malformed_user_id_is_number(mock_client_cls):
    """Signup response with numeric user id should return 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, {
        "access_token": "valid-token",
        "user": {"id": 12345, "email": "u@e.com"},
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "u@e.com", "password": "Pass123!"})

    assert resp.status_code == 503


# ---------------------------------------------------------------------------
# Nested user fields
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_signup_nested_user_fields(mock_client_cls):
    """Supabase may return user nested — should still succeed."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = _make_httpx_response(200, {
        "access_token": "nested-token-123",
        "user": {
            "id": "nested-id",
            "email": "nested@example.com",
            "aud": "authenticated",
        },
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "nested@example.com", "password": "Pass123!"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"] == "nested-token-123"
    assert data["user"]["id"] == "nested-id"
    assert data["user"]["email"] == "nested@example.com"


# ---------------------------------------------------------------------------
# get_current_user tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_get_current_user_valid(mock_client_cls):
    """Valid Bearer token should return user object via /api/auth/me."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = _make_httpx_response(200, {
        "id": "user-123",
        "email": "me@example.com",
    })
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # We test get_current_user as a dependency by hitting an endpoint
        # that uses it. Since we don't have a /me endpoint yet, we test
        # the function directly.
        from backend.api.auth import get_current_user
        from starlette.requests import Request as StarletteRequest

        scope = {
            "type": "http",
            "method": "GET",
            "headers": [(b"authorization", b"Bearer valid-token-here")],
        }
        request = StarletteRequest(scope)
        user = await get_current_user(request)

    assert user["id"] == "user-123"
    assert user["email"] == "me@example.com"


@pytest.mark.anyio
async def test_get_current_user_missing_header():
    """Missing Authorization header should raise 401."""
    from backend.api.auth import get_current_user
    from starlette.requests import Request as StarletteRequest
    from fastapi import HTTPException

    scope = {"type": "http", "method": "GET", "headers": []}
    request = StarletteRequest(scope)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


@pytest.mark.anyio
async def test_get_current_user_empty_bearer():
    """Empty Bearer token should raise 401."""
    from backend.api.auth import get_current_user
    from starlette.requests import Request as StarletteRequest
    from fastapi import HTTPException

    scope = {"type": "http", "method": "GET", "headers": [(b"authorization", b"Bearer ")]}
    request = StarletteRequest(scope)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_get_current_user_invalid_token(mock_client_cls):
    """Supabase returning 401 should raise 401."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.return_value = _make_httpx_response(401, {"error": "invalid_token"})
    mock_client_cls.return_value = mock_client

    from backend.api.auth import get_current_user
    from starlette.requests import Request as StarletteRequest
    from fastapi import HTTPException

    scope = {"type": "http", "method": "GET", "headers": [(b"authorization", b"Bearer bad-token")]}
    request = StarletteRequest(scope)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 401


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_get_current_user_provider_outage(mock_client_cls):
    """Supabase transport error should raise 503."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.get.side_effect = httpx.ConnectError("connection refused")
    mock_client_cls.return_value = mock_client

    from backend.api.auth import get_current_user
    from starlette.requests import Request as StarletteRequest
    from fastapi import HTTPException

    scope = {"type": "http", "method": "GET", "headers": [(b"authorization", b"Bearer some-token")]}
    request = StarletteRequest(scope)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request)
    assert exc_info.value.status_code == 503


# ---------------------------------------------------------------------------
# Sentinel secret no-leak tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_no_leak_signup(mock_client_cls):
    """Sentinel secret must not appear in signup response body."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.side_effect = httpx.ConnectError(f"auth failed: {_SENTINEL_SECRET}")
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/signup", json={"email": "u@e.com", "password": "Pass123!"})

    body = resp.text
    assert _SENTINEL_SECRET not in body
    assert "sb-secret" not in body


@pytest.mark.anyio
@patch("backend.api.auth._SUPABASE_URL", _SENTINEL_URL)
@patch("backend.api.auth._SUPABASE_KEY", _SENTINEL_SECRET)
@patch("httpx.Client")
async def test_no_leak_login(mock_client_cls):
    """Sentinel secret must not appear in login response body."""
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.side_effect = httpx.ConnectError(f"connection failed: {_SENTINEL_SECRET}")
    mock_client_cls.return_value = mock_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/auth/login", json={"email": "u@e.com", "password": "Pass123!"})

    body = resp.text
    assert _SENTINEL_SECRET not in body
    assert "sb-secret" not in body


@pytest.mark.anyio
async def test_health_still_works():
    """GET /api/health should still return 200 after auth router is added."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}