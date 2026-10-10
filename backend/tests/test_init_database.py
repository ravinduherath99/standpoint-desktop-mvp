"""Tests for backend/init_database.py — mocked, no live database."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import init_database  # noqa: E402

_MOCK_CHECK_SQL = """\
-- table_exists
SELECT true AS ok;

-- columns_complete
SELECT true AS ok;

-- other
SELECT true AS ok;
"""
_MOCK_NAMES = ["table_exists", "columns_complete", "other"]


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_SETUP_URL", raising=False)


def _mock_conn_ok():
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn.cursor.return_value = cursor
    return conn


class TestInitDatabase:

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_success_table_missing(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch, capsys
    ):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        mock_run_checks.return_value = (False, [
            {"name": "table_exists", "ok": False},
            {"name": "col", "ok": True},
        ])
        conn = _mock_conn_ok()
        mock_connect.return_value = conn
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 0
        assert "OK" in out
        conn.commit.assert_called_once()

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_success_already_correct(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch, capsys
    ):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        mock_run_checks.return_value = (True, [
            {"name": "table_exists", "ok": True},
        ])
        conn = _mock_conn_ok()
        mock_connect.return_value = conn
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 0
        assert "correct schema" in out
        conn.rollback.assert_called()
        conn.cursor.return_value.execute.assert_not_called()

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_connection_failure(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch, capsys
    ):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        mock_connect.side_effect = psycopg2.OperationalError("refused")
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "connect" in out.lower()

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_tls_timeout(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch
    ):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        mock_run_checks.return_value = (False, [
            {"name": "table_exists", "ok": False},
        ])
        conn = _mock_conn_ok()
        mock_connect.return_value = conn
        init_database.main()
        _, kwargs = mock_connect.call_args
        assert kwargs.get("sslmode") == "require"
        assert kwargs.get("connect_timeout") == 10
        assert "statement_timeout" in kwargs.get("options", "")

    def test_import_safety(self):
        """Importing init_database must not execute DDL."""
        assert hasattr(init_database, "main")
        assert callable(init_database.main)

    @patch("init_database._SETUP_SQL")
    def test_no_secret_leakage(self, mock_path, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL",
                           "postgresql://admin:s3cret@db/prod")
        mock_path.read_text.return_value = "SELECT 1;"
        with patch("init_database.psycopg2.connect") as mock_connect:
            mock_connect.side_effect = psycopg2.OperationalError("s3cret err")
            code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "s3cret" not in out
        assert "postgresql://" not in out

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_database_setup_url_preferred(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch
    ):
        monkeypatch.setenv("DATABASE_URL", "postgresql://runtime")
        monkeypatch.setenv("DATABASE_SETUP_URL", "postgresql://setup")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        mock_run_checks.return_value = (False, [
            {"name": "table_exists", "ok": False},
        ])
        conn = _mock_conn_ok()
        mock_connect.return_value = conn
        init_database.main()
        dsn_arg = mock_connect.call_args[0][0]
        assert dsn_arg == "postgresql://setup"

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_rollback_on_failure(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch, capsys
    ):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        mock_run_checks.return_value = (False, [
            {"name": "table_exists", "ok": False},
        ])
        conn = _mock_conn_ok()
        cursor = conn.cursor.return_value
        cursor.execute.side_effect = psycopg2.Error("DDL failed")
        mock_connect.return_value = conn
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        conn.rollback.assert_called()
        conn.commit.assert_not_called()


    def test_missing_config(self, monkeypatch, capsys):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        monkeypatch.delenv("DATABASE_SETUP_URL", raising=False)
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "No database URL" in out

    @patch("init_database._SETUP_SQL")
    def test_missing_sql_file(self, mock_path, monkeypatch, capsys):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_path.read_text.side_effect = FileNotFoundError("no file")
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "setup.sql" in out
