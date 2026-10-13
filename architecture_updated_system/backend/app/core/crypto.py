"""Legacy-compatible cryptography helpers.

Byte-compatible with the original services so encrypted payloads, search
tokens and integrity hashes interoperate across the recreated backend, the
TS client (``quotations-ui``) and the Dart client (``skaner``).

Derivation (must not change):
    KEK      = sha256(MASTER_KEY + "-kek")
    HMAC_KEY = sha256(MASTER_KEY + "-hmac")
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
from functools import lru_cache

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import get_settings


@lru_cache(maxsize=1)
def _kek() -> bytes:
    return hashlib.sha256((get_settings().master_key + "-kek").encode()).digest()


@lru_cache(maxsize=1)
def _hmac_key() -> bytes:
    return hashlib.sha256((get_settings().master_key + "-hmac").encode()).digest()


# ── Deterministic search tokens ─────────────────────────────────────────────
def get_search_token(value: str) -> str:
    """Deterministic HMAC-SHA256 token for exact-match search over PII."""
    if not value:
        return ""
    normalized = value.strip().lower()
    return hmac.new(_hmac_key(), normalized.encode(), hashlib.sha256).hexdigest()


# ── Envelope encryption ─────────────────────────────────────────────────────
def encrypt_field(plaintext: str, dek: bytes) -> dict:
    nonce = os.urandom(12)
    ciphertext = AESGCM(dek).encrypt(nonce, plaintext.encode("utf-8"), None)
    return {"ciphertext": ciphertext.hex(), "nonce": nonce.hex()}


def decrypt_field(encrypted_data: dict, dek: bytes) -> str:
    nonce = bytes.fromhex(encrypted_data["nonce"])
    ciphertext = bytes.fromhex(encrypted_data["ciphertext"])
    return AESGCM(dek).decrypt(nonce, ciphertext, None).decode("utf-8")


def encrypt_dict(data: dict, sensitive_fields: list[str]) -> dict:
    dek = AESGCM.generate_key(bit_length=256)
    dek_nonce = os.urandom(12)
    wrapped_dek = AESGCM(_kek()).encrypt(dek_nonce, dek, None)

    encrypted: dict = {}
    for key, val in data.items():
        if key in sensitive_fields and val is not None:
            if isinstance(val, str):
                val_str, is_json = val, False
            else:
                val_str, is_json = json.dumps(val), True
            field = encrypt_field(val_str, dek)
            field["is_json"] = is_json
            encrypted[key] = field
        else:
            encrypted[key] = val

    encrypted["encryption_metadata"] = {
        "version": 1,
        "algorithm": "AES-256-GCM",
        "keyId": "master-key-v1",
        "wrappedDek": {"ciphertext": wrapped_dek.hex(), "nonce": dek_nonce.hex()},
    }
    return encrypted


def decrypt_dict(encrypted_data: dict, sensitive_fields: list[str]) -> dict:
    if not encrypted_data:
        return encrypted_data
    if "encryption_metadata" not in encrypted_data:
        return {
            k: v
            for k, v in encrypted_data.items()
            if k != "encryption_metadata" and not k.endswith("_search")
        }

    wrapped = encrypted_data["encryption_metadata"]["wrappedDek"]
    dek = AESGCM(_kek()).decrypt(
        bytes.fromhex(wrapped["nonce"]), bytes.fromhex(wrapped["ciphertext"]), None
    )

    out: dict = {}
    for key, val in encrypted_data.items():
        if key == "encryption_metadata" or key.endswith("_search"):
            continue
        if key in sensitive_fields and isinstance(val, dict) and "ciphertext" in val:
            dec = decrypt_field(val, dek)
            out[key] = json.loads(dec) if val.get("is_json") else dec
        else:
            out[key] = val
    return out


# ── Config-value encryption (optional encrypted .env fragments) ─────────────
def encrypt_config_value(plaintext: str) -> str:
    nonce = os.urandom(12)
    ciphertext = AESGCM(_kek()).encrypt(nonce, plaintext.encode(), None)
    return f"encv1:{ciphertext.hex()}:{nonce.hex()}"


def decrypt_config_value(stored: str) -> str:
    if not stored.startswith("encv1:"):
        return stored
    _, ciphertext_hex, nonce_hex = stored.split(":", 2)
    return AESGCM(_kek()).decrypt(
        bytes.fromhex(nonce_hex), bytes.fromhex(ciphertext_hex), None
    ).decode("utf-8")


# ── API keys + constant-time compare ────────────────────────────────────────
def hash_api_key(plain_key: str) -> str:
    if not plain_key:
        return ""
    return hmac.new(_hmac_key(), plain_key.encode(), hashlib.sha256).hexdigest()


def constant_time_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


# ── Request signing ─────────────────────────────────────────────────────────
def canonical_request(method: str, path: str, timestamp: str, body_hash: str) -> str:
    return "\n".join([method.upper(), path, timestamp, body_hash])


def sign_request(api_key: str, method: str, path: str, timestamp: str, body_hash: str) -> str:
    canonical = canonical_request(method, path, timestamp, body_hash)
    return hmac.new(api_key.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def verify_request_signature(
    api_key: str, method: str, path: str, timestamp: str, body_hash: str, provided: str
) -> bool:
    return constant_time_equal(
        sign_request(api_key, method, path, timestamp, body_hash), provided
    )


# ── Canonical JSON (must match TS/Dart clients) ─────────────────────────────
def canonical_json(value) -> str:
    """Compact, key-sorted, UTF-8-preserving JSON for cross-platform hashes."""
    return json.dumps(
        value, sort_keys=True, default=str, separators=(",", ":"), ensure_ascii=False
    )


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
