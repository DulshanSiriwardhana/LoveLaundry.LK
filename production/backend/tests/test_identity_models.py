import pytest

from app.identity.models import (
    generate_epc,
    new_linen_id,
    new_tag_serial,
    normalize_epc,
    normalize_owner_code,
    normalize_qr,
    normalize_tid,
    public_qr_view,
    qr_payload,
    is_valid_structured_id,
    series_and_number,
    structured_item_code,
    structured_linen_id,
)


def test_linen_ids_are_deterministic_and_category_aware() -> None:
    assert new_linen_id("bedsheet", 1) == "BED-000001"
    assert new_linen_id("Bath Towel", 5000) == "TOW-005000"
    assert new_linen_id("", 7) == "LIN-000007"


def test_structured_ids_encode_item_owner_and_starting_number() -> None:
    assert structured_item_code("BEDSHEET", "King Bedsheet") == "BS"
    assert structured_item_code("TOWEL", "") == "TW"
    assert structured_item_code("DUVET_COVER", "duvet cover") == "DC"
    assert normalize_owner_code("g") == "G"
    assert structured_linen_id("BEDSHEET", "King Bedsheet", "G", 1) == "BSG-A0001XL"
    assert structured_linen_id("BEDSHEET", "", "G", 12345) == "BSG-B2346BH"
    assert series_and_number(9999) == ("A", 9999)
    assert series_and_number(10000) == ("B", 1)


def test_structured_id_rejects_invalid_owner_or_sequence() -> None:
    with pytest.raises(ValueError):
        normalize_owner_code("TOO-LONG-CODE")
    with pytest.raises(ValueError):
        structured_linen_id("BEDSHEET", "", "G", 0)
    with pytest.raises(ValueError):
        structured_linen_id("BEDSHEET", "", "G", 259975)


def test_only_checksummed_ids_are_valid() -> None:
    assert is_valid_structured_id("BSG-A0001XL") is True
    assert is_valid_structured_id("BSG-A0001XY") is False
    assert is_valid_structured_id("BSG-00001") is False
    assert is_valid_structured_id("LL-7K4P92") is False
    assert is_valid_structured_id("BSG-A0000AA") is False


def test_epc_is_fixed_width_hex_and_unique() -> None:
    first = generate_epc(1, "3039")
    second = generate_epc(2, "3039")
    assert len(first) == 24
    assert first.startswith("3039")
    assert first != second
    assert normalize_epc(first.lower()) == first
    assert normalize_epc(first.replace("3039", "30:39")) == first


def test_epc_rejects_invalid_values() -> None:
    with pytest.raises(ValueError):
        normalize_epc("not-hex")
    with pytest.raises(ValueError):
        normalize_epc("3039")


def test_qr_identifier_survives_url_and_domain_change() -> None:
    stable = new_linen_id("bedsheet", 1)
    url = qr_payload("https://tags.example.com", stable)
    assert url == f"https://tags.example.com/i/{stable}"
    assert normalize_qr(stable) == stable
    assert normalize_qr(url) == stable
    assert normalize_qr(f"https://other-domain.example/i/{stable}") == stable


def test_tag_serial_and_optional_tid() -> None:
    assert new_tag_serial(1) == "TAG-000001"
    assert normalize_tid("") == ""
    tid = generate_epc(1, "e2", 24)
    assert normalize_tid(tid) == tid


def test_public_qr_view_hides_ownership_and_pricing() -> None:
    view = public_qr_view(
        {
            "linen_id": "BED-000001",
            "item_type": "bedsheet",
            "category": "bed",
            "status": "ACTIVE",
            "organization_id": "hotel-secret",
            "owner_organization_id": "hotel-secret",
            "purchase_price": 12.5,
            "history": ["secret"],
        }
    )
    assert view == {
        "linen_id": "BED-000001",
        "item_type": "bedsheet",
        "category": "bed",
        "status": "ACTIVE",
    }
