"""Signed-request authentication for the insights module (legacy love-ai parity).

Every insight request must present a hashed API key (``X-API-Key``) and an HMAC
request signature (``X-Timestamp``, ``X-Body-Hash``, ``X-Signature``) that binds
caller identity + payload + timestamp (rejects tampering and replay).
"""
from __future__ import annotations

import time

import jwt
from fastapi import Depends, Header, HTTPException, Request, Security, status
from fastapi.security import HTTPBearer

from ...core.config import get_settings
from ...core.crypto import (
    constant_time_equal,
    hash_api_key,
    sha256_hex,
    verify_request_signature,
)

security = HTTPBearer(auto_error=False)


def get_insights_repo(request: Request):
    return request.app.state.insights_repo


def _api_key_hashes() -> list[str]:
    return [hash_api_key(k) for k in get_settings().ai_api_keys_raw]


def verify_api_key(x_api_key: str | None = Header(None, alias="X-API-Key")) -> str:
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-API-Key header")
    provided_hash = hash_api_key(x_api_key)
    for stored_hash in _api_key_hashes():
        if constant_time_equal(provided_hash, stored_hash):
            return x_api_key
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


async def verify_signed_request(
    request: Request,
    api_key: str = Depends(verify_api_key),
    x_timestamp: str | None = Header(None, alias="X-Timestamp"),
    x_body_hash: str | None = Header(None, alias="X-Body-Hash"),
    x_signature: str | None = Header(None, alias="X-Signature"),
) -> dict:
    if not x_timestamp or not x_body_hash or not x_signature:
        raise HTTPException(
            status_code=401,
            detail="Missing signature headers (X-Timestamp, X-Body-Hash, X-Signature)",
        )

    try:
        ts = int(x_timestamp)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid X-Timestamp")

    if abs(int(time.time()) - ts) > get_settings().signature_ttl_seconds:
        raise HTTPException(status_code=401, detail="Request signature expired")

    body = await request.body()
    if not constant_time_equal(sha256_hex(body), x_body_hash):
        raise HTTPException(status_code=401, detail="Body hash mismatch — request payload tampered")

    signed_path = request.url.path
    if request.url.query:
        signed_path = f"{signed_path}?{request.url.query}"

    ok = verify_request_signature(
        api_key, request.method, signed_path, x_timestamp, x_body_hash, x_signature
    )
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid request signature")
    return {"api_key": api_key, "path": signed_path, "timestamp": ts}


def optional_current_user(credentials=Security(security)) -> dict | None:
    """Resolve an attached user-service JWT for audit attribution, if any."""
    if not credentials or not credentials.credentials:
        return None
    secret = get_settings().jwt_secret
    if not secret:
        return None
    try:
        return jwt.decode(credentials.credentials, secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None
