"""Tests for backend/check_tables.py — mocked, no live database."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import check_tables  # noqa: E402

_MOCK_CHECK_SQL = """\
-- This is a comment block to skip
-- (no query here)

-- check_alpha
SELECT true AS ok;

-- check_beta
SELECT false AS ok;
"""

_MOCK_NAMES = ["check_alpha", "check_beta"]


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)


def _mock_cursor(results):
    """Return a mock cursor yielding the given boolean-like values."""
    cursor = MagicMock()
    cursor.fetchone.side_effect = [
        MagicMock(__getitem__=lambda s, i, v=v: v) for v in results
    ]
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    return cursor


class TestCheckTables:

    def test_missing_table(self):
        with patch.object(check_tables, "CHECK_NAMES", _MOCK_NAMES),              patch.object(check_tables, "load_check_queries",
                          return_value=_MOCK_CHECK_SQL):
            conn = MagicMock()
            conn.cursor.return_value = _mock_cursor([True, False])
            all_ok, results = check_tables.run_checks(conn)
        assert all_ok is False
        assert any(not r["ok"] for r in results)

    def test_success_all_pass(self):
        with patch.object(check_tables, "CHECK_NAMES", _MOCK_NAMES),              patch.object(check_tables, "load_check_queries",
                          return_value=_MOCK_CHECK_SQL):
            conn = MagicMock()
            conn.cursor.return_value = _mock_cursor([True, True])
            all_ok, results = check_tables.run_checks(conn)
        assert all_ok is True
        assert len(results) == 2

    def test_partial_failure(self):
        with patch.object(check_tables, "CHECK_NAMES", _MOCK_NAMES),              patch.object(check_tables, "load_check_queries",
                          return_value=_MOCK_CHECK_SQL):
            conn = MagicMock()
            conn.cursor.return_value = _mock_cursor([True, False])
            all_ok, results = check_tables.run_checks(conn)
        assert all_ok is False
        assert results[0]["ok"] is True
        assert results[1]["ok"] is False

    def test_missing_config(self, monkeypatch, capsys):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        code = check_tables.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "DATABASE_URL" in out

    def test_main_success(self, monkeypatch, capsys):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        with patch.object(check_tables, "CHECK_NAMES", _MOCK_NAMES),              patch.object(check_tables, "load_check_queries",
                          return_value=_MOCK_CHECK_SQL),              patch.object(check_tables.psycopg2, "connect") as mc:
            conn = MagicMock()
            conn.cursor.return_value = _mock_cursor([True, True])
            mc.return_value = conn
            code = check_tables.main()
        out = capsys.readouterr().out
        assert code == 0
        assert "PASS" in out

    def test_no_secret_leakage_connect_error(self, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL",
                           "postgresql://admin:s3cret@db/prod")
        with patch.object(check_tables.psycopg2, "connect") as mc:
            mc.side_effect = psycopg2.OperationalError("s3cret err")
            code = check_tables.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "s3cret" not in out
        assert "postgresql://" not in out

    def test_no_secret_leakage_sql_error(self, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL",
                           "postgresql://admin:hunter2@db/prod")
        with patch.object(check_tables, "CHECK_NAMES", _MOCK_NAMES),              patch.object(check_tables, "load_check_queries",
                          return_value=_MOCK_CHECK_SQL),              patch.object(check_tables.psycopg2, "connect") as mc:
            cursor = MagicMock()
            cursor.execute.side_effect = psycopg2.Error("hunter2 fail")
            cursor.__enter__ = MagicMock(return_value=cursor)
            cursor.__exit__ = MagicMock(return_value=False)
            conn = MagicMock()
            conn.cursor.return_value = cursor
            mc.return_value = conn
            code = check_tables.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "hunter2" not in out
