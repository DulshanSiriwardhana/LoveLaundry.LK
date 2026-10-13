"""Crypto parity tests. The canonical_json golden string is the cross-language
contract shared with quotations-ui (TS) and skaner (Dart)."""
from __future__ import annotations

from app.core.crypto import (
    canonical_json,
    decrypt_dict,
    encrypt_dict,
    get_search_token,
    hash_api_key,
    sign_request,
    verify_request_signature,
)


def test_canonical_json_is_compact_sorted_utf8():
    value = {"b": 1, "a": "é", "c": {"z": 2, "y": 3}}
    assert canonical_json(value) == '{"a":"é","b":1,"c":{"y":3,"z":2}}'


def test_canonical_json_has_no_spaces():
    assert canonical_json({"x": [1, 2, 3]}) == '{"x":[1,2,3]}'


def test_search_token_deterministic_and_normalised():
    assert get_search_token("  Alice ") == get_search_token("alice")
    assert get_search_token("") == ""
    assert get_search_token("alice") != get_search_token("bob")


def test_envelope_roundtrip():
    doc = {"name": "Alice", "amount": 100, "meta": {"k": "v"}}
    enc = encrypt_dict(doc, sensitive_fields=["name", "meta"])
    assert "encryption_metadata" in enc
    assert enc["amount"] == 100  # non-sensitive untouched
    assert "ciphertext" in enc["name"]
    dec = decrypt_dict(enc, sensitive_fields=["name", "meta"])
    assert dec["name"] == "Alice"
    assert dec["meta"] == {"k": "v"}
    assert dec["amount"] == 100


def test_api_key_hash_and_signing():
    h = hash_api_key("secret-key")
    assert len(h) == 64
    sig = sign_request("secret-key", "POST", "/x", "123", "abc")
    assert verify_request_signature("secret-key", "POST", "/x", "123", "abc", sig)
    assert not verify_request_signature("secret-key", "POST", "/x", "123", "abc", "bad")
