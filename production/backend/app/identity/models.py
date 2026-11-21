"""Programmatic, collision-resistant identity primitives for hybrid linen tags.

No supplier value, hotel value, RFID value or public domain is hardcoded here.
All prefixes and lengths are supplied by configuration or by the caller.
"""

from __future__ import annotations

import re
import uuid

ITEM_TYPE_PREFIXES = {
    "bed sheet": "BED",
    "bedsheet": "BED",
    "sheet": "BED",
    "duvet": "DUV",
    "duvet cover": "DUV",
    "pillow": "PIL",
    "pillow case": "PIL",
    "pillowcase": "PIL",
    "towel": "TOW",
    "bath towel": "TOW",
    "table cloth": "TBL",
    "tablecloth": "TBL",
    "napkin": "NAP",
    "blanket": "BLK",
    "curtain": "CUR",
    "robe": "ROB",
}

_HEX = re.compile(r"^[0-9a-fA-F]+$")
_QR_PATH = re.compile(r"/i/([A-Za-z0-9._-]+)")
_SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def item_type_prefix(item_type: str, fallback: str = "LIN") -> str:
    key = (item_type or "").strip().lower()
    if not key:
        return fallback
    if key in ITEM_TYPE_PREFIXES:
        return ITEM_TYPE_PREFIXES[key]
    compact = re.sub(r"[^A-Za-z0-9]", "", key).upper()
    return compact[:4] if len(compact) >= 3 else fallback


def new_linen_id(item_type: str, sequence: int) -> str:
    """Return a permanent, human-readable linen identifier."""

    if sequence < 0:
        raise ValueError("Linen sequence must be non-negative")
    return f"{item_type_prefix(item_type)}-{sequence:06d}"


def new_tag_serial(sequence: int, prefix: str = "TAG") -> str:
    if sequence < 0:
        raise ValueError("Tag sequence must be non-negative")
    return f"{prefix.strip().upper() or 'TAG'}-{sequence:06d}"


def normalize_epc(value: str, expected_length: int = 24) -> str:
    """Normalize an EPC read into canonical upper-case hex.

    Reader vendor SDKs report EPCs with mixed case and occasional
    separators; the stored identifier must have exactly one representation.
    """

    cleaned = re.sub(r"[\s:;\-]", "", str(value or "")).upper()
    if not cleaned:
        raise ValueError("EPC is required")
    if not _HEX.match(cleaned):
        raise ValueError("EPC must contain hexadecimal characters only")
    if expected_length and len(cleaned) != expected_length:
        raise ValueError(f"EPC must be {expected_length} hexadecimal characters")
    return cleaned


def generate_epc(sequence: int, prefix_hex: str = "3039", length: int = 24) -> str:
    """Generate a unique 96-bit (default) EPC.

    ``prefix_hex`` is an organization/hardware-neutral GS1 or private prefix.
    Random material keeps identifiers unguessable; the sequence keeps them
    ordered and makes bulk imports deterministic to reconcile.
    """

    if sequence < 0:
        raise ValueError("EPC sequence must be non-negative")
    prefix = re.sub(r"[^0-9A-Fa-f]", "", prefix_hex or "").upper()
    if not prefix or not _HEX.match(prefix):
        raise ValueError("EPC prefix must be hexadecimal")
    random_part = uuid.uuid4().hex[:12].upper()
    sequence_part = f"{sequence % (16**8):08X}"
    body = f"{prefix}{random_part}{sequence_part}"
    if len(body) > length:
        body = body[:length]
    return body.ljust(length, "0")


def normalize_tid(value: str, expected_length: int = 24) -> str:
    if not value:
        return ""
    return normalize_epc(value, expected_length)


def normalize_qr(value: str) -> str:
    """Extract the stable identifier from a raw code or a QR resolution URL."""

    raw = str(value or "").strip()
    if not raw:
        raise ValueError("QR identifier is required")
    match = _QR_PATH.search(raw)
    if match:
        raw = match.group(1)
    elif "://" in raw:
        raw = raw.rstrip("/").rsplit("/", 1)[-1]
    raw = raw.strip()
    if not _SAFE_ID.match(raw):
        raise ValueError("QR identifier contains unsupported characters")
    return raw


def qr_payload(base_url: str, qr_id: str) -> str:
    """Build a resolvable QR URL without embedding any confidential data."""

    base = str(base_url or "").strip().rstrip("/")
    identifier = normalize_qr(qr_id)
    if not base:
        raise ValueError("A configured QR base URL is required")
    return f"{base}/i/{identifier}"


def public_qr_view(item: dict) -> dict:
    """Only non-confidential fields may leave the public resolution endpoint."""

    return {
        "linen_id": str(item.get("linen_id") or ""),
        "item_type": str(item.get("item_type") or item.get("category") or ""),
        "category": str(item.get("category") or ""),
        "status": str(item.get("status") or "ACTIVE"),
    }
