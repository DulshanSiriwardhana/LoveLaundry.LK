"""Shared core primitives for the recreated backend.

Submodules:
  config   - typed settings (pydantic-settings)
  clock    - timezone-aware app clock
  errors   - uniform error payloads + exception handlers
  crypto   - AES-256-GCM envelope + HMAC helpers (legacy-compatible)
  security - JWT auth + role dependencies
"""
