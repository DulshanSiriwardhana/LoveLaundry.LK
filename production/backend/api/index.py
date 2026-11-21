"""Vercel serverless entry point for the production rebuild backend."""

from app.main import app

__all__ = ["app"]
