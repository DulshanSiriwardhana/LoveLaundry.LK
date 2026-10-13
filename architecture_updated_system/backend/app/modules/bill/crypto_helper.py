"""Bill-service crypto helpers.

Thin shim over the shared, byte-compatible :mod:`app.core.crypto`. The only
behaviour it adds over the core is the legacy convenience of writing the
deterministic ``<field>_search`` token alongside an encrypted searchable field
(``client_name`` / ``email`` / ``mobile_number``) during ``encrypt_dict`` — the
exact contract the legacy collectors and search queries rely on.
"""
from __future__ import annotations

from ...core.crypto import (  # noqa: F401
    decrypt_dict,
    decrypt_field,
    encrypt_field,
    get_search_token,
)
from ...core.crypto import encrypt_dict as _encrypt_dict

_SEARCHABLE = ("client_name", "email", "mobile_number")


def encrypt_dict(data: dict, sensitive_fields: list) -> dict:
    """Envelope-encrypt ``sensitive_fields`` and add ``_search`` tokens.

    Matches the legacy ``crypto_helper.encrypt_dict`` byte-for-byte: the search
    token is computed over the plaintext (the JSON string when the value is not
    already a string), so a value written by either service is findable by the
    other.
    """
    encrypted = _encrypt_dict(data, sensitive_fields)
    for key in _SEARCHABLE:
        if key in sensitive_fields and data.get(key) is not None:
            value = data[key]
            token_src = value if isinstance(value, str) else __import__("json").dumps(value)
            encrypted[f"{key}_search"] = get_search_token(token_src)
    return encrypted
