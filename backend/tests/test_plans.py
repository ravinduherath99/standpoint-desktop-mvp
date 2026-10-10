import re
from datetime import date, timedelta
from unittest.mock import MagicMock

import psycopg2
import pytest
from httpx import ASGITransport, AsyncClient

from backend.api.index import app
from backend.api.auth import get_current_user


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def anyio_backend():
    return "asyncio"


_VALID_USER = {"id": "user-aaa-111", "email": "test@example.com"}
_VALID_TOKEN = "eyJhbGciOiJIUzI1NiJ9.valid.token"
REFERENCE_PATTERN = re.compile(r"^SP-[a-f0-9]{32}$")


def _future_date(days=30):
    return (date.today() + timedelta(days=days)).isoformat()


def _valid_payload(**overrides):
    payload = {
        "location": "Carlton Gardens, East Lawn",
        "shootDate": _future_date(),
        "startTime": "14:00",
        "duration": "2 hours",
        "shootTypes": ["Portrait", "Wedding"],
        "people": "5",
        "equipment": ["Camera", "Tripod"],
        "lightingPlan": None,
        "accessNotes": "Main entrance gate will be open. Contact venue manager on arrival.",
        "consent": True,
    }
    payload.update(overrides)
    return payload


def _auth_headers():
    return {"Authorization": "Bearer " + _VALID_TOKEN}


def _mock_user(user=None):
    app.dependency_overrides[get_current_user] = lambda: (user or _VALID_USER)


def _mock_conn(insert_ok=True, fetchone_result=None):
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    if not insert_ok:
        cursor.execute.side_effect = psycopg2.OperationalError("connection refused")
    cursor.fetchone.return_value = fetchone_result
    conn.cursor.return_value = cursor
    return conn


class TestReferenceFormat:
    def test_valid_refs(self):
        assert REFERENCE_PATTERN.match("SP-" + "a" * 32)
        assert REFERENCE_PATTERN.match("SP-" + "f" * 32)
        assert REFERENCE_PATTERN.match("SP-" + "0" * 32)
    def test_short(self):
        assert not REFERENCE_PATTERN.match("SP-" + "a" * 31)
    def test_long(self):
        assert not REFERENCE_PATTERN.match("SP-" + "a" * 33)
    def test_uppercase(self):
        assert not REFERENCE_PATTERN.match("SP-" + "A" * 32)
    def test_wrong_prefix(self):
        assert not REFERENCE_PATTERN.match("XX-" + "a" * 32)
    def test_empty(self):
        assert not REFERENCE_PATTERN.match("")


class TestPostAuth:
    @pytest.mark.anyio
    async def test_no_token_401(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload())
        assert r.status_code == 401

    @pytest.mark.anyio
    async def test_bad_token_401(self):
        def _bad():
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        app.dependency_overrides[get_current_user] = _bad
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        assert r.status_code == 401


class TestExtraFields:
    @pytest.mark.anyio
    async def test_user_id_rejected(self):
        _mock_user()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(user_id="x"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_reference_rejected(self):
        _mock_user()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(reference="SP-x"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_email_rejected(self):
        _mock_user()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(email="a@b.com"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_password_rejected(self):
        _mock_user()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(password="x"), headers=_auth_headers())
        assert r.status_code == 422


class TestFieldValidation:
    @pytest.mark.anyio
    async def test_location_too_short(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(location="AB"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_location_too_long(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(location="A" * 161), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_location_trimmed(self):
        _mock_user()
        with __import__("unittest.mock", fromlist=["patch"]).patch("backend.api.plans._get_connection") as mg:
            mg.return_value = _mock_conn()
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.post("/api/plans", json=_valid_payload(location="  Carlton  "), headers=_auth_headers())
        assert r.status_code == 201

    @pytest.mark.anyio
    async def test_past_date(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(shootDate="2020-01-01"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_bad_date_format(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(shootDate="01-01-2030"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_feb30(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(shootDate="2030-02-30"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_bad_time(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(startTime="25:00"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_bad_duration(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(duration="45 min"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_empty_shoot_types(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(shootTypes=[]), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_bad_shoot_type(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(shootTypes=["Portrait", "Invalid"]), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_dup_shoot_type(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(shootTypes=["Portrait", "Portrait"]), headers=_auth_headers())
        assert r.status_code == 422


class TestPeopleAndEquipment:
    @pytest.mark.anyio
    async def test_people_zero(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(people="0"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_people_51(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(people="51"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_people_bool(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(people=True), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_people_fraction(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(people="3.5"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_drone_rejected(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(equipment=["Camera", "Drone"]), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_empty_equipment(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(equipment=[]), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_consent_false(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(consent=False), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_access_notes_short(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(accessNotes="Short"), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_lighting_needs_plan(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(equipment=["Camera", "Lighting"], lightingPlan=None), headers=_auth_headers())
        assert r.status_code == 422

    @pytest.mark.anyio
    async def test_lighting_short_plan(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.post("/api/plans", json=_valid_payload(equipment=["Camera", "Lighting"], lightingPlan="short"), headers=_auth_headers())
        assert r.status_code == 422


from unittest.mock import patch

class TestDatabase:
    @pytest.mark.anyio
    async def test_success_201(self):
        _mock_user()
        with patch("backend.api.plans._get_connection") as mg:
            mg.return_value = _mock_conn()
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        assert r.status_code == 201
        data = r.json()
        assert "reference" in data
        assert REFERENCE_PATTERN.match(data["reference"])

    @pytest.mark.anyio
    async def test_user_id_from_token(self):
        app.dependency_overrides[get_current_user] = lambda: {"id": "tid", "email": "x@y.com"}
        with patch("backend.api.plans._get_connection") as mg:
            conn = _mock_conn()
            mg.return_value = conn
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        assert r.status_code == 201
        cur = conn.cursor.return_value
        args = cur.execute.call_args[0][1]
        assert args[0] == "tid"

    @pytest.mark.anyio
    async def test_rollback_on_db_error(self):
        _mock_user()
        with patch("backend.api.plans._get_connection") as mg:
            conn = _mock_conn(insert_ok=False)
            mg.return_value = conn
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        assert r.status_code == 500
        conn.rollback.assert_called_once()
        conn.commit.assert_not_called()
        assert "connection" not in r.json().get("detail", "").lower()

    @pytest.mark.anyio
    async def test_conn_closed_success(self):
        _mock_user()
        with patch("backend.api.plans._get_connection") as mg:
            conn = _mock_conn()
            mg.return_value = conn
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        conn.close.assert_called_once()

    @pytest.mark.anyio
    async def test_conn_closed_error(self):
        _mock_user()
        with patch("backend.api.plans._get_connection") as mg:
            conn = _mock_conn(insert_ok=False)
            mg.return_value = conn
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        conn.close.assert_called_once()

    @pytest.mark.anyio
    async def test_no_raw_db_error(self):
        _mock_user()
        conn = MagicMock()
        cur = MagicMock()
        cur.__enter__ = MagicMock(return_value=cur)
        cur.__exit__ = MagicMock(return_value=False)
        cur.execute.side_effect = psycopg2.OperationalError("FATAL: password auth failed for admin")
        conn.cursor.return_value = cur
        with patch("backend.api.plans._get_connection", return_value=conn):
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        assert r.status_code == 500
        body = r.text
        assert "password" not in body.lower()
        assert "admin" not in body.lower()

    @pytest.mark.anyio
    async def test_no_db_url(self):
        _mock_user()
        with patch.dict("os.environ", {"DATABASE_URL": ""}, clear=False):
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        assert r.status_code == 500

    @pytest.mark.anyio
    async def test_tls_params(self):
        _mock_user()
        conn = _mock_conn()
        with patch("backend.api.plans.psycopg2.connect", return_value=conn) as mc:
            import os
            os.environ["DATABASE_URL"] = "postgresql://x"
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
            _, kw = mc.call_args
            assert kw.get("sslmode") == "require"
            assert kw.get("connect_timeout") == 10
            assert "statement_timeout" in kw.get("options", "")


class TestGetPlan:
    @pytest.mark.anyio
    async def test_no_token_401(self):
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.get("/api/plans/SP-" + "a" * 32)
        assert r.status_code == 401

    @pytest.mark.anyio
    async def test_bad_ref_404(self):
        _mock_user()
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.get("/api/plans/INVALID", headers=_auth_headers())
        assert r.status_code == 404

    @pytest.mark.anyio
    async def test_missing_404(self):
        _mock_user()
        with patch("backend.api.plans._get_connection") as mg:
            mg.return_value = _mock_conn(fetchone_result=None)
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.get("/api/plans/SP-" + "a" * 32, headers=_auth_headers())
        assert r.status_code == 404

    @pytest.mark.anyio
    async def test_other_owner_404(self):
        app.dependency_overrides[get_current_user] = lambda: {"id": "other", "email": "o@t.com"}
        with patch("backend.api.plans._get_connection") as mg:
            mg.return_value = _mock_conn(fetchone_result=None)
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.get("/api/plans/SP-" + "a" * 32, headers=_auth_headers())
        assert r.status_code == 404

    @pytest.mark.anyio
    async def test_success(self):
        _mock_user()
        from datetime import datetime
        row = {
            "reference": "SP-" + "a" * 32,
            "location": "Carlton Gardens",
            "shoot_date": date(2030, 6, 15),
            "start_time": "14:00:00",
            "duration": "2 hours",
            "shoot_types": ["Portrait"],
            "people": 5,
            "equipment": ["Camera"],
            "lighting_plan": None,
            "access_notes": "Enter via main gate on Royal Parade.",
            "consent": True,
            "created_at": datetime(2030, 1, 1, 12, 0, 0),
        }
        with patch("backend.api.plans._get_connection") as mg:
            mg.return_value = _mock_conn(fetchone_result=row)
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r = await c.get("/api/plans/SP-" + "a" * 32, headers=_auth_headers())
        assert r.status_code == 200
        d = r.json()
        assert d["reference"] == "SP-" + "a" * 32
        assert d["plan"]["location"] == "Carlton Gardens"
        assert d["plan"]["shootDate"] == "2030-06-15"
        assert d["plan"]["startTime"] == "14:00"
        assert d["plan"]["people"] == 5
        assert "id" not in d
        assert "user_id" not in d
        assert "id" not in d["plan"]
        assert "user_id" not in d["plan"]

    @pytest.mark.anyio
    async def test_parametrized_query(self):
        _mock_user()
        from datetime import datetime
        row = {"reference": "SP-" + "a" * 32, "location": "G", "shoot_date": date(2030, 6, 15), "start_time": "14:00:00", "duration": "2h", "shoot_types": ["P"], "people": 5, "equipment": ["C"], "lighting_plan": None, "access_notes": "Main gate on Royal Parade, enter carefully.", "consent": True, "created_at": datetime(2030, 1, 1)}
        conn = _mock_conn(fetchone_result=row)
        with patch("backend.api.plans.psycopg2.connect", return_value=conn):
            import os
            os.environ["DATABASE_URL"] = "postgresql://x"
            ref = "SP-" + "b" * 32
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                await c.get(f"/api/plans/{ref}", headers=_auth_headers())
        cur = conn.cursor.return_value
        sql = cur.execute.call_args[0][0]
        params = cur.execute.call_args[0][1]
        assert "WHERE reference = %s AND user_id = %s" in sql
        assert params[0] == ref
        assert params[1] == "user-aaa-111"


class TestMisc:
    @pytest.mark.anyio
    async def test_health(self):
        t = ASGITransport(app=app)
        async with AsyncClient(transport=t, base_url="http://test") as c:
            r = await c.get("/api/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    @pytest.mark.anyio
    async def test_duplicate_refs_differ(self):
        _mock_user()
        with patch("backend.api.plans._get_connection") as mg:
            mg.return_value = _mock_conn()
            t = ASGITransport(app=app)
            async with AsyncClient(transport=t, base_url="http://test") as c:
                r1 = await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
                r2 = await c.post("/api/plans", json=_valid_payload(), headers=_auth_headers())
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["reference"] != r2.json()["reference"]

    def test_schema_unchanged(self):
        from pathlib import Path
        sql = (Path(__file__).resolve().parent.parent / "sql" / "setup.sql").read_text()
        assert "CREATE TABLE IF NOT EXISTS public.shoot_plans" in sql
        assert "consent       boolean     NOT NULL" in sql

