"""Bill-service settings.

Delegates to the shared, env-anchored :func:`app.core.config.get_settings` so the
bill module uses the *same* secrets and role-resolution semantics as the rest of
the recreated backend (rather than a second, independently-loaded ``.env``).
"""
from __future__ import annotations

from ...core.config import get_settings

settings = get_settings()
