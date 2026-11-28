"""Encryption helpers shared by records created by the older services.

The operational collections (gate passes, deliveries, bills and shop bills) use
envelope encryption: a random data key encrypts the sensitive fields, the
configured master key wraps that data key, and exact-match lookups use an HMAC
search token. Keeping the format here lets the rebuilt backend read the same
documents without duplicating the cryptographic contract in every router.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.fernet import Fernet

from .config import get_settings

ENVELOPE_VERSION = 1
ENVELOPE_ALGORITHM = "AES-256-GCM"
ENVELOPE_KEY_ID = "master-key-v1"


def new_fernet() -> Fernet:
    return Fernet(Fernet.generate_key())


def encrypt(fernet: Fernet, plaintext: str) -> str:
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt(fernet: Fernet, token: str) -> str:
    return fernet.decrypt(token.encode()).decode()


def _keys() -> tuple[bytes, bytes]:
    master_key = get_settings().master_key
    return (
        hashlib.sha256((master_key + "-kek").encode()).digest(),
        hashlib.sha256((master_key + "-hmac").encode()).digest(),
    )


def search_token(value: str | None) -> str:
    """Deterministic exact-match token for an encrypted searchable field."""

    if value is None or str(value).strip() == "":
        return ""
    _, hmac_key = _keys()
    return hmac.new(
        hmac_key, str(value).strip().lower().encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _validate_metadata(meta: dict) -> None:
    if not isinstance(meta, dict):
        raise ValueError("Encryption metadata is malformed")
    if meta.get("version") is not None and int(meta["version"]) != ENVELOPE_VERSION:
        raise ValueError("Unsupported encryption envelope version")
    if str(meta.get("algorithm") or "").strip().upper() != ENVELOPE_ALGORITHM:
        raise ValueError("Unsupported encryption algorithm")
    if not isinstance(meta.get("wrappedDek"), dict):
        raise ValueError("Encryption metadata is missing the wrapped data key")


def _unwrap_dek(meta: dict) -> bytes:
    kek, _ = _keys()
    wrapped = meta["wrappedDek"]
    nonce = bytes.fromhex(str(wrapped["nonce"]))
    ciphertext = bytes.fromhex(str(wrapped["ciphertext"]))
    return AESGCM(kek).decrypt(nonce, ciphertext, None)


def _encrypt_field(plaintext: str, dek: bytes) -> dict:
    nonce = os.urandom(12)
    ciphertext = AESGCM(dek).encrypt(nonce, plaintext.encode("utf-8"), None)
    return {"ciphertext": ciphertext.hex(), "nonce": nonce.hex()}


def _decrypt_field(value: dict, dek: bytes) -> str:
    nonce = bytes.fromhex(str(value["nonce"]))
    ciphertext = bytes.fromhex(str(value["ciphertext"]))
    return AESGCM(dek).decrypt(nonce, ciphertext, None).decode("utf-8")


def encrypt_document(document: dict, sensitive_fields) -> dict:
    """Return an envelope-encrypted copy of one stored document."""

    fields = set(sensitive_fields or [])
    dek = AESGCM.generate_key(bit_length=256)
    kek, _ = _keys()
    kek_nonce = os.urandom(12)
    wrapped = {
        "ciphertext": AESGCM(kek).encrypt(kek_nonce, dek, None).hex(),
        "nonce": kek_nonce.hex(),
    }

    encrypted: dict = {}
    for key, value in document.items():
        if key in fields and value is not None:
            is_json = not isinstance(value, str)
            plaintext = json.dumps(value) if is_json else value
            field = _encrypt_field(plaintext, dek)
            field["is_json"] = is_json
            encrypted[key] = field
            if key == "client_name":
                encrypted["client_name_search"] = search_token(plaintext)
            elif key == "email":
                encrypted["email_search"] = search_token(plaintext)
            elif key == "mobile_number":
                encrypted["mobile_number_search"] = search_token(plaintext)
        else:
            encrypted[key] = value

    encrypted["encryption_metadata"] = {
        "version": ENVELOPE_VERSION,
        "algorithm": ENVELOPE_ALGORITHM,
        "keyId": ENVELOPE_KEY_ID,
        "wrappedDek": wrapped,
    }
    return encrypted


def _plaintext_view(document: dict) -> dict:
    return {
        key: value
        for key, value in document.items()
        if key != "encryption_metadata" and not str(key).endswith("_search")
    }


def decrypt_document(document: dict, sensitive_fields) -> dict:
    """Return a decrypted copy, tolerating legacy plaintext documents."""

    if not isinstance(document, dict):
        return document
    if "encryption_metadata" not in document:
        return _plaintext_view(document)

    meta = document["encryption_metadata"]
    try:
        _validate_metadata(meta)
        dek = _unwrap_dek(meta)
        fields = set(sensitive_fields or [])
        decrypted: dict = {}
        for key, value in document.items():
            if key == "encryption_metadata":
                continue
            if (
                key in fields
                and isinstance(value, dict)
                and "ciphertext" in value
                and "nonce" in value
            ):
                plaintext = _decrypt_field(value, dek)
                decrypted[key] = json.loads(plaintext) if value.get("is_json") else plaintext
            elif str(key).endswith("_search"):
                continue
            else:
                decrypted[key] = value
        return decrypted
    except (KeyError, TypeError, ValueError):
        # A plaintext row that happens to carry stale metadata must not break a
        # whole listing. Search tokens are still withheld from the response.
        return _plaintext_view(document)
