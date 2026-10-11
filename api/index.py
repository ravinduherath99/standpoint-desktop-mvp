"""Vercel entry point for the existing StandPoint FastAPI application."""

from backend.api.index import app

__all__ = ["app"]