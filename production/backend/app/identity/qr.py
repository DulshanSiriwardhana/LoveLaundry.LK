"""Real QR rendering for printable hybrid linen tags.

The encoder is a pure-Python QR implementation; the SVG is generated from the
encoded matrix, never from an external image service. No payload or domain is
embedded here by default — callers pass the configured resolvable URL.
"""

from __future__ import annotations

import qrcode
from qrcode.image.svg import SvgPathImage


def render_qr_svg(value: str, box_size: int = 8, border: int = 3) -> str:
    """Return a standard QR SVG for ``value`` suitable for tag sheets.

    Error correction ``M`` keeps dense tag sheets readable while allowing
    modest label damage. The returned fragment keeps its own viewBox so it can
    be embedded at any scale in a larger printable sheet.
    """

    payload = str(value or "").strip()
    if not payload:
        raise ValueError("QR payload is required")
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(image_factory=SvgPathImage)
    svg = image.to_string().decode("utf-8") if isinstance(image.to_string(), bytes) else image.to_string()
    # Nested SVG fragments inherit the outer sheet's declarations; removing the
    # duplicate XML declaration keeps the combined document valid.
    return svg.replace('<?xml version="1.0" encoding="UTF-8"?>', "").strip()
