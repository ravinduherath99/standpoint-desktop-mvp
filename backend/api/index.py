"""
StandPoint API — FastAPI application entry point.

Loads environment variables from backend/.env using a module-relative path
before any settings are read. Exports ``app`` for uvicorn import
(e.g. ``backend.api.index:app``).
"""

from pathlib import Path

from dotenv import load_dotenv

# Resolve backend/.env relative to this file (backend/api/index.py → backend/.env)
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_ENV_PATH)

import os  # noqa: E402 — must come after load_dotenv

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from backend.api.auth import router as auth_router
from backend.api.plans import router as plans_router  # noqa: E402

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(title="StandPoint API", version="0.1.0")

# ---------------------------------------------------------------------------
# CORS — exact-origin, credentials disabled
# ---------------------------------------------------------------------------

_FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_FRONTEND_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(auth_router, prefix="/api")
app.include_router(plans_router, prefix="/api")


@app.get("/api/health")
async def health():
    """Simple liveness probe."""
    return {"status": "ok"}