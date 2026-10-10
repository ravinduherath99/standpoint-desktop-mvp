"""
init_database — one-time explicit setup command for public.shoot_plans.

This is a CLI tool, NOT an API endpoint or startup hook.  Importing this
module, starting FastAPI, or deploying must never execute DDL.

Reads backend/sql/setup.sql (the reviewed DDL) and executes it unchanged in
its existing transaction. Uses DATABASE_SETUP_URL when privately supplied,
otherwise DATABASE_URL; the setup-only variable must never replace runtime
settings. Connects with sslmode="require", connect_timeout=10, and a bounded
statement timeout.

Before running DDL, preflights with check_tables.run_checks() to detect an
incompatible existing table. CREATE IF NOT EXISTS does not repair an
incompatible table; this script stops and reports a safe schema mismatch
instead of dropping or silently altering it.

Never prints the URL, credentials, row data, or raw exceptions.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Resolve backend/.env relative to this file (backend/init_database.py → backend/.env)
_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(_ENV_PATH)

import psycopg2  # noqa: E402 — must come after load_dotenv

from check_tables import run_checks  # noqa: E402 — shared read-only schema checks

# Path to the reviewed DDL
_SETUP_SQL = Path(__file__).resolve().parent / "sql" / "setup.sql"


def main() -> int:
    """Run the database setup. Returns 0 on success, 1 on failure."""
    # DATABASE_SETUP_URL is optional and private; DATABASE_URL is the fallback.
    dsn = os.getenv("DATABASE_SETUP_URL") or os.getenv("DATABASE_URL")
    if not dsn:
        print("ERROR: No database URL configured (DATABASE_SETUP_URL or DATABASE_URL).")
        return 1

    try:
        setup_sql = _SETUP_SQL.read_text(encoding="utf-8")
    except FileNotFoundError:
        print("ERROR: backend/sql/setup.sql not found.")
        return 1
    except Exception:
        print("ERROR: Could not read setup.sql.")
        return 1

    conn = None
    try:
        conn = psycopg2.connect(
            dsn,
            sslmode="require",
            connect_timeout=10,
            options="-c statement_timeout=10000",
        )
        conn.autocommit = False

        # --- Preflight: check existing schema before DDL ---
        try:
            all_passed, results = run_checks(conn)
            if all_passed:
                print("OK: public.shoot_plans already exists with the correct schema. Skipping DDL.")
                conn.rollback()
                return 0
            # If table_exists is True but not all checks passed → incompatible table
            table_exists = any(
                r["name"] == "table_exists" and r["ok"] for r in results
            )
            if table_exists:
                failed = [r["name"] for r in results if not r["ok"]]
                print(
                    "ERROR: public.shoot_plans already exists but does not match "
                    f"the expected schema. Failed checks: {', '.join(failed)}. "
                    "Review and resolve manually — no changes were made."
                )
                conn.rollback()
                return 1
            # Table doesn't exist yet → proceed with DDL
        except psycopg2.Error:
            # Preflight query itself failed (e.g. table truly doesn't exist,
            # information_schema inaccessible) — proceed with DDL.
            conn.rollback()

        # --- Execute the reviewed DDL unchanged ---
        with conn.cursor() as cur:
            cur.execute(setup_sql)

        conn.commit()
        print("OK: Database setup completed successfully.")
        return 0

    except psycopg2.OperationalError:
        print("ERROR: Could not connect to the database.")
        return 1
    except psycopg2.Error as exc:
        # Rollback on any database error
        if conn is not None:
            try:
                conn.rollback()
            except Exception:
                pass
        print(f"ERROR: Database setup failed (code {exc.pgcode or 'unknown'}).")
        return 1
    except Exception:
        print("ERROR: An unexpected error occurred during database setup.")
        return 1
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
