"""Schema mismatch / incompatible-table tests for init_database.py.

Verifies that init_database detects an existing table with wrong schema
and reports a safe error without DROP/ALTER or secret leakage.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import init_database  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_SETUP_URL", raising=False)


def _conn():
    conn = MagicMock()
    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn.cursor.return_value = cursor
    return conn


class TestSchemaCompat:

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_schema_mismatch_detected(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch, capsys
    ):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        # table_exists=True but other checks fail → incompatible
        mock_run_checks.return_value = (False, [
            {"name": "table_exists", "ok": True},
            {"name": "columns_complete", "ok": False},
            {"name": "column_types", "ok": False},
        ])
        conn = _conn()
        mock_connect.return_value = conn
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "does not match" in out
        assert "columns_complete" in out
        # DDL must not have been executed
        execute_calls = conn.cursor.return_value.execute.call_args_list
        assert all("SELECT 1" not in str(c) for c in execute_calls)

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_no_secret_leakage_mismatch(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch, capsys
    ):
        monkeypatch.setenv("DATABASE_URL",
                           "postgresql://admin:s3cret@db/prod")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        mock_run_checks.return_value = (False, [
            {"name": "table_exists", "ok": True},
            {"name": "columns_complete", "ok": False},
        ])
        conn = _conn()
        mock_connect.return_value = conn
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "s3cret" not in out
        assert "postgresql://" not in out

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_rollback_on_mismatch(
        self, mock_connect, mock_sql_path, mock_run_checks, monkeypatch, capsys
    ):
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        mock_sql_path.read_text.return_value = "SELECT 1;"
        mock_run_checks.return_value = (False, [
            {"name": "table_exists", "ok": True},
            {"name": "columns_complete", "ok": False},
        ])
        conn = _conn()
        mock_connect.return_value = conn
        code = init_database.main()
        assert code == 1
        conn.rollback.assert_called()
        conn.commit.assert_not_called()
