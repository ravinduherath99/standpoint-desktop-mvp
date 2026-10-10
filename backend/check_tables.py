"""
check_tables — read-only schema validator for public.shoot_plans.

Loads backend/sql/check_schema.sql relative to this module and executes each
named verification query against the database. Prints pass/fail per check name
with the table name, plus a summary. A valid empty table is success.
Never prints connection strings, passwords, row data, or raw exceptions.

The run_checks(conn) function is shared with init_database.py for preflight
validation, so both modules use the same verification rules.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Resolve backend/.env relative to this file (backend/check_tables.py → backend/.env)
_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(_ENV_PATH)

import psycopg2  # noqa: E402 — must come after load_dotenv

# Path to the shared read-only verification SQL
_CHECK_SCHEMA_SQL = (
    Path(__file__).resolve().parent / "sql" / "check_schema.sql"
)

# Ordered check names matching the queries in check_schema.sql
CHECK_NAMES = [
    "table_exists",
    "columns_complete",
    "column_types",
    "id_primary_key",
    "reference_unique",
    "user_id_fk",
    "shoot_types_json_array_check",
    "equipment_json_array_check",
    "people_range_check",
    "consent_true_check",
    "indexes_present",
    "rls_enabled",
    "no_table_policies",
    "no_signup_triggers",
]


def load_check_queries() -> str:
    """Load check_schema.sql content. Raises FileNotFoundError if missing."""
    return _CHECK_SCHEMA_SQL.read_text(encoding="utf-8")


def _extract_query(chunk: str) -> str:
    """Strip leading comment lines and blank lines from a SQL chunk.

    After splitting on ';', each chunk contains leading ``-- ...`` comment
    lines followed by the actual SELECT query.  This helper removes the
    comments so only the executable SQL remains.
    """
    for line in chunk.strip().splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("--"):
            # Found the first non-comment, non-blank line — return everything
            # from here onward (the query may itself contain mid-statement
            # comments, which PostgreSQL handles fine).
            idx = chunk.index(line)
            return chunk[idx:].strip()
    return ""


def run_checks(conn) -> tuple[bool, list[dict]]:
    """Execute read-only schema checks on an open connection.

    Returns (all_passed, results) where results is a list of dicts with
    keys 'name' (str) and 'ok' (bool). Does not print anything — the caller
    decides how to report.
    """
    sql = load_check_queries()
    results: list[dict] = []

    with conn.cursor() as cur:
        for name, chunk in zip(CHECK_NAMES, sql.split(";")):
            query = _extract_query(chunk)
            if not query:
                continue
            cur.execute(query)
            row = cur.fetchone()
            ok = bool(row and row[0])
            results.append({"name": name, "ok": ok})

    all_passed = all(r["ok"] for r in results)
    return all_passed, results


def main() -> int:
    """Run all schema checks and print a pass/fail report. Returns 0 or 1."""
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("ERROR: DATABASE_URL is not configured.")
        return 1

    conn = None
    try:
        conn = psycopg2.connect(dsn, sslmode="require", connect_timeout=10)
        conn.set_session(readonly=True, autocommit=True)

        all_passed, results = run_checks(conn)

        print(f"Schema checks for public.shoot_plans:")
        for r in results:
            status = "PASS" if r["ok"] else "FAIL"
            print(f"  [{status}] {r['name']}")

        passed = sum(1 for r in results if r["ok"])
        total = len(results)
        print(f"\n{passed}/{total} checks passed.")

        return 0 if all_passed else 1

    except FileNotFoundError:
        print("ERROR: check_schema.sql not found.")
        return 1
    except psycopg2.OperationalError:
        print("ERROR: Could not connect to the database.")
        return 1
    except psycopg2.Error:
        print("ERROR: A database error occurred while checking the schema.")
        return 1
    except Exception:
        print("ERROR: An unexpected error occurred.")
        return 1
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
