"""
check_database — simple liveness probe for public.shoot_plans.

Loads environment variables from backend/.env relative to this module.
Connects with sslmode="require" and connect_timeout=10.
Confirms public.shoot_plans exists (SELECT with LIMIT 0 — touches the table
without reading data). Prints only a safe success or error message: never a
connection string, password, or raw exception. Closes the connection on all
paths. Returns exit code 0 on success, 1 on failure.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Resolve backend/.env relative to this file (backend/check_database.py → backend/.env)
_ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(_ENV_PATH)

import psycopg2  # noqa: E402 — must come after load_dotenv


def main() -> int:
    """Check that public.shoot_plans exists. Returns 0 on success, 1 on failure."""
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("ERROR: DATABASE_URL is not configured.")
        return 1

    conn = None
    try:
        conn = psycopg2.connect(dsn, sslmode="require", connect_timeout=10)
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM public.shoot_plans LIMIT 0")
        print("OK: public.shoot_plans exists.")
        return 0
    except psycopg2.OperationalError:
        print("ERROR: Could not connect to the database or table does not exist.")
        return 1
    except psycopg2.Error:
        print("ERROR: Table public.shoot_plans does not exist or is inaccessible.")
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
