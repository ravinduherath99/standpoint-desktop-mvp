"""Tests for the /api/health endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from backend.api.index import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_health_returns_ok():
    """GET /api/health should return 200 with {\"status\": \"ok\"}."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_health_content_type():
    """GET /api/health should return application/json."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")

    assert response.headers["content-type"] == "application/json"