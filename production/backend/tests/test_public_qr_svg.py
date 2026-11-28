"""Public QR image endpoint coverage (no auth, live URL, rate-limited)."""

from __future__ import annotations

from app.identity.models import is_valid_structured_id, structured_linen_id
from app.identity.qr import render_qr_svg


def test_public_qr_svg_encodes_the_items_live_url(client) -> None:
    created = client.post(
        "/tags/items",
        json={
            "organization_id": "hotel-qr-svg",
            "item_type": "bedsheet",
            "category": "BEDSHEET",
            "owner_code": "G",
            "start_number": 1,
        },
    )
    assert created.status_code == 200
    linen_id = created.json()["linen_id"]
    qr_url = created.json()["qr_url"]
    # The documented checksum scheme: BSG-A0001XL is a valid structured tag.
    assert linen_id == "BSG-A0001XL"
    assert is_valid_structured_id(linen_id)
    assert qr_url.endswith(f"/i/{linen_id}")

    response = client.get(f"/i/{linen_id}/qr.svg")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert response.text.strip().startswith("<svg")
    assert "<path" in response.text
    # A byte-for-byte match with the renderer proves the encoded payload is the
    # item's configured, resolvable URL rather than a placeholder or an ID.
    assert response.text.strip() == render_qr_svg(qr_url).strip()
    # The public image must not leak ownership, pricing or tag history.
    for secret in ("organization_id", "owner_code", "epc", "price", "history"):
        assert secret not in response.text


def test_public_qr_svg_returns_404_for_unknown_structured_id(client) -> None:
    unknown_id = structured_linen_id("BEDSHEET", "bedsheet", "G", 2)
    assert is_valid_structured_id(unknown_id)

    response = client.get(f"/i/{unknown_id}/qr.svg")

    assert response.status_code == 404


def test_public_qr_svg_returns_404_for_legacy_and_bad_checksum_ids(client) -> None:
    # BSG-A0001XY is the same series/number as a valid tag but has a wrong
    # checksum, so it must be rejected just like non-structured legacy codes.
    assert not is_valid_structured_id("BSG-A0001XY")
    for code in ("LL-123456", "BSG-00001", "BSG-A0001XY"):
        response = client.get(f"/i/{code}/qr.svg")
        assert response.status_code == 404
