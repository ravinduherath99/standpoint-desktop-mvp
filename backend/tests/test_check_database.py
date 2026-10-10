"""Tests for backend/check_database.py — mocked, no live database."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import check_database  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    """Ensure DATABASE_URL is absent between tests."""
    monkeypatch.delenv("DATABASE_URL", raising=False)


# --- helpers ---------------------------------------------------------------

def _mock_conn_ok():
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn.cursor.return_value = cursor
    return conn


def _mock_conn_fail(exc_class):
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    cursor.execute.side_effect = exc_class("boom")
    conn.cursor.return_value = cursor
    return conn


# --- tests -----------------------------------------------------------------

class TestCheckDatabase:

    def test_missing_config(self, monkeypatch, capsys):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        code = check_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "DATABASE_URL" in out
        assert "postgresql://" not in out

    @patch("check_database.psycopg2.connect")
    def test_success(self, mock_connect, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_connect.return_value = _mock_conn_ok()
        code = check_database.main()
        out = capsys.readouterr().out
        assert code == 0
        assert "OK" in out

    @patch("check_database.psycopg2.connect")
    def test_missing_table(self, mock_connect, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_connect.return_value = _mock_conn_fail(psycopg2.ProgrammingError)
        code = check_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "ERROR" in out

    @patch("check_database.psycopg2.connect")
    def test_connection_failure(self, mock_connect, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_connect.side_effect = psycopg2.OperationalError("refused")
        code = check_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "ERROR" in out

    @patch("check_database.psycopg2.connect")
    def test_tls_require(self, mock_connect, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_connect.return_value = _mock_conn_ok()
        check_database.main()
        _, kwargs = mock_connect.call_args
        assert kwargs.get("sslmode") == "require"

    @patch("check_database.psycopg2.connect")
    def test_timeout_10(self, mock_connect, monkeypatch):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_connect.return_value = _mock_conn_ok()
        check_database.main()
        _, kwargs = mock_connect.call_args
        assert kwargs.get("connect_timeout") == 10

    @patch("check_database.psycopg2.connect")
    def test_no_secret_leakage(self, mock_connect, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", "postgresql://admin:s3cret@db.example.com/prod")
        mock_connect.side_effect = psycopg2.OperationalError("s3cret boom")
        code = check_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "s3cret" not in out
        assert "postgresql://" not in out
