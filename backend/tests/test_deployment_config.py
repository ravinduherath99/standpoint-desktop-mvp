"""Regression tests for the single-project Vercel deployment configuration."""

import importlib.util
import json
from pathlib import Path

from backend.api.index import app as backend_app


ROOT = Path(__file__).resolve().parents[2]
EXPECTED_EXCLUDE_FILES = (
    "{frontend/**,backend/.venv/**,backend/tests/**,**/__pycache__/**,"
    "**/.pytest_cache/**,**/.env,**/.env.*,**/*.pyc,.git/**,.vercel/**}"
)
RUNTIME_REQUIREMENTS = {
    "fastapi",
    "uvicorn[standard]",
    "httpx",
    "python-dotenv",
    "psycopg2-binary",
}


def _non_comment_lines(path: Path) -> list[str]:
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def test_root_api_wrapper_exposes_existing_application():
    wrapper_path = ROOT / "api" / "index.py"
    spec = importlib.util.spec_from_file_location("standpoint_vercel_api", wrapper_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.app is backend_app


def test_python_version_is_supported_312():
    assert (ROOT / ".python-version").read_text(encoding="utf-8").strip() == "3.12"


def test_root_requirements_contain_runtime_dependencies_only():
    root_requirements = set(_non_comment_lines(ROOT / "requirements.txt"))
    backend_requirements = set(_non_comment_lines(ROOT / "backend" / "requirements.txt"))

    assert root_requirements == RUNTIME_REQUIREMENTS
    assert RUNTIME_REQUIREMENTS < backend_requirements
    assert "pytest" not in root_requirements
    assert "pytest" in backend_requirements


def test_vercel_configuration_matches_single_deployment_shape():
    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))

    assert config["framework"] is None
    assert config["buildCommand"] == "cd frontend && npm ci && npm run build"
    assert config["outputDirectory"] == "frontend/dist"
    assert "builds" not in config
    assert "installCommand" not in config

    assert set(config["functions"]) == {"api/index.py"}
    function_config = config["functions"]["api/index.py"]
    assert function_config["maxDuration"] == 60
    assert isinstance(function_config["excludeFiles"], str)
    assert function_config["excludeFiles"] == EXPECTED_EXCLUDE_FILES
    assert "backend/api/**" not in function_config["excludeFiles"]
    assert "api/index.py" not in function_config["excludeFiles"]

    assert config["routes"] == [
        {"src": "/api/(.*)", "dest": "/api/index.py"},
        {"handle": "filesystem"},
        {"src": "/(.*)", "dest": "/index.html"},
    ]


def test_gitignore_covers_private_and_generated_files_but_keeps_templates():
    rules = _non_comment_lines(ROOT / ".gitignore")

    for expected in (
        ".env",
        ".env.*",
        "!.env.example",
        ".venv/",
        "node_modules/",
        "dist/",
        "__pycache__/",
        "*.pyc",
        ".pytest_cache/",
        "tmp/",
        "temp/",
        "*.tmp",
        "*.temp",
        ".vercel/",
    ):
        assert expected in rules

    assert (ROOT / "backend" / ".env.example").is_file()
    assert (ROOT / "frontend" / ".env.example").is_file()


def test_frontend_environment_template_contains_no_backend_secrets():
    frontend_env = (ROOT / "frontend" / ".env.example").read_text(encoding="utf-8")

    assert "VITE_API_BASE_URL=" in frontend_env
    assert "VITE_SUPABASE" not in frontend_env
    assert "VITE_DATABASE" not in frontend_env
    assert "DATABASE_URL" not in frontend_env