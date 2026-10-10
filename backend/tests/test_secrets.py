"""Cross-cutting secret-leakage tests for all three database modules.

Verifies that connection strings, passwords, and raw exceptions never appear
in stdout/stderr output from check_database, check_tables, or init_database.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import check_database  # noqa: E402
import check_tables    # noqa: E402
import init_database   # noqa: E402


SECRET_DSN = "postgresql://admin:v3ry$ecret!@db.internal.supabase.co:5432/prod"


@pytest.fixture(autouse=True)
def _reset_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_SETUP_URL", raising=False)


# --- check_database --------------------------------------------------------

class TestCheckDatabaseSecrets:

    @patch("check_database.psycopg2.connect")
    def test_operational_error_no_leak(self, mock_connect, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", SECRET_DSN)
        mock_connect.side_effect = psycopg2.OperationalError(
            f"connection to db.internal failed: password={SECRET_DSN}"
        )
        code = check_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "v3ry$ecret!" not in out
        assert "postgresql://" not in out

    @patch("check_database.psycopg2.connect")
    def test_generic_error_no_leak(self, mock_connect, monkeypatch, capsys):
        monkeypatch.setenv("DATABASE_URL", SECRET_DSN)
        mock_connect.side_effect = RuntimeError(
            f"host=db.internal password=v3ry$ecret!"
        )
        code = check_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "v3ry$ecret!" not in out


# --- check_tables ----------------------------------------------------------

class TestCheckTablesSecrets:

    @patch("check_tables.psycopg2.connect")
    def test_connect_error_no_leak(self, mock_connect, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", SECRET_DSN)
        mock_connect.side_effect = psycopg2.OperationalError(
            f"auth failed for admin: {SECRET_DSN}"
        )
        code = check_tables.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "v3ry$ecret!" not in out
        assert "postgresql://" not in out

    @patch("check_tables.load_check_queries")
    @patch("check_tables.psycopg2.connect")
    def test_runtime_error_no_leak(self, mock_connect, mock_load,
                                   monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", SECRET_DSN)
        mock_load.return_value = "SELECT 1;"
        mock_connect.side_effect = psycopg2.Error(
            f"unexpected: {SECRET_DSN}"
        )
        code = check_tables.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "v3ry$ecret!" not in out


# --- init_database ---------------------------------------------------------

class TestInitDatabaseSecrets:

    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_connect_error_no_leak(self, mock_connect, mock_sql,
                                   monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", SECRET_DSN)
        mock_sql.read_text.return_value = "SELECT 1;"
        mock_connect.side_effect = psycopg2.OperationalError(
            f"could not connect: {SECRET_DSN}"
        )
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "v3ry$ecret!" not in out
        assert "postgresql://" not in out

    @patch("init_database.run_checks")
    @patch("init_database._SETUP_SQL")
    @patch("init_database.psycopg2.connect")
    def test_ddl_error_no_leak(self, mock_connect, mock_sql,
                               mock_checks, monkeypatch, capsys):
        import psycopg2
        monkeypatch.setenv("DATABASE_URL", SECRET_DSN)
        mock_sql.read_text.return_value = "SELECT 1;"
        mock_checks.return_value = (False, [
            {"name": "table_exists", "ok": False},
        ])
        conn = MagicMock()
        cursor = MagicMock()
        cursor.__enter__ = MagicMock(return_value=cursor)
        cursor.__exit__ = MagicMock(return_value=False)
        cursor.execute.side_effect = psycopg2.Error(
            f"permission denied for {SECRET_DSN}"
        )
        conn.cursor.return_value = cursor
        mock_connect.return_value = conn
        code = init_database.main()
        out = capsys.readouterr().out
        assert code == 1
        assert "v3ry$ecret!" not in out
