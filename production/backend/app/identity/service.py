"""Tag management: identity creation, mapping import/activation and replacement."""

from __future__ import annotations

import re

from fastapi import HTTPException, status

from ..core.principal import assert_organization_access, is_platform_admin
from ..events.models import new_event, utc_now
from ..events.outbox import OutboxStore
from .models import (
    MAX_LINEN_SEQUENCE,
    generate_epc,
    is_valid_structured_id,
    new_tag_serial,
    normalize_epc,
    normalize_owner_code,
    normalize_qr,
    normalize_tid,
    public_qr_view,
    qr_payload,
    structured_item_code,
    structured_linen_id,
)
from .repository import IdentityRepository

ACTIVE = "ACTIVE"
INACTIVE = "INACTIVE"
BATCH_VERIFIED = "VERIFIED"
BATCH_ACTIVE = "ACTIVE"
REQUIRED_MAPPING_FIELDS = ("linen_id", "qr_id", "epc")


def _setting(settings, name: str, default):
    return getattr(settings, name, default)


class IdentityService:
    def __init__(self, repository: IdentityRepository, outbox: OutboxStore, settings=None) -> None:
        self.repository = repository
        self.outbox = outbox
        self.settings = settings

    def _base_url(self) -> str:
        value = _setting(self.settings, "qr_base_url", "")
        if not value:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "QR_BASE_URL is not configured",
            )
        return str(value)

    def _epc_config(self) -> tuple[str, int]:
        prefix = str(_setting(self.settings, "epc_prefix_hex", "") or "").strip()
        if not prefix:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "RFID_EPC_PREFIX_HEX is not configured",
            )
        return prefix, int(_setting(self.settings, "epc_length", 24))

    def epc_config(self) -> tuple[str, int]:
        """Public accessor used by the shared scan transaction engine."""

        return self._epc_config()

    async def find_by_method(self, method: str, identifier: str) -> dict | None:
        key = str(method or "").strip().lower()
        if key in {"qr", "qr_code", "qrcode"}:
            return await self.repository.find_by_qr(normalize_qr(identifier))
        if key in {"rfid", "epc", "uhf"}:
            _, length = self._epc_config()
            return await self.repository.find_by_epc(normalize_epc(identifier, length))
        return None

    def _organization(self, payload: dict, principal: dict) -> str:
        requested = str(payload.get("organization_id") or "").strip()
        if not requested:
            requested = str(principal.get("organization_id") or "").strip()
        if not requested and not is_platform_admin(principal):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "An organization_id is required"
            )
        assert_organization_access(principal, requested)
        return requested

    async def _owner_code(self, organization_id: str, payload: dict) -> str:
        """Resolve the hotel code used in a structured tag.

        The central hotel record wins. ``owner_code`` is accepted only for
        older callers/tests that have no registry record yet; the platform UI
        never offers a free-text code field.
        """

        record_code = await self.repository.find_organization_code(organization_id)
        if record_code:
            return normalize_owner_code(record_code)

        supplied = str(payload.get("owner_code") or "").strip()
        if supplied:
            return normalize_owner_code(supplied)

        # Backward compatibility for API clients created before hotel codes
        # were stored on registry records (e.g. ``hotel-a`` -> ``HA``).
        words = re.findall(r"[A-Za-z0-9]+", organization_id or "")
        fallback = "".join(word[0] for word in words)[:5] if words else "ORG"
        return normalize_owner_code(fallback or "ORG")

    @staticmethod
    def _assert_mapping_organization(
        rows: list[dict], organization_id: str, principal: dict
    ) -> None:
        """Reject import rows addressed to an organization other than the batch owner.

        Row-level ``organization_id`` values originate in an uploaded file. They
        must never be able to override the batch scope when items are created.
        """

        for row in rows:
            row_org = str(row.get("organization_id") or "").strip()
            if row_org and row_org != organization_id:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Tag mapping row belongs to another organization",
                )
            assert_organization_access(principal, row_org or organization_id)

    async def _unique_epc(self, epc: str) -> None:
        if await self.repository.find_by_epc(epc) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, f"EPC {epc} is already assigned")

    async def _unique_qr(self, qr_id: str) -> None:
        if await self.repository.find_by_qr(qr_id) is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT, f"QR identifier {qr_id} is already assigned"
            )

    def _item_document(
        self,
        *,
        linen_id: str,
        qr_id: str,
        epc: str,
        serial: str,
        tid: str,
        organization_id: str,
        payload: dict,
        owner_code: str = "",
        item_code: str = "",
    ) -> dict:
        return {
            "linen_id": linen_id,
            "qr_id": qr_id,
            "qr_url": qr_payload(self._base_url(), qr_id),
            "epc": epc,
            "tag_serial": serial,
            "tid": tid,
            "rfid_technology": "UHF EPC Gen2 / ISO 18000-63",
            "item_type": str(payload.get("item_type") or payload.get("category") or ""),
            "category": str(payload.get("category") or ""),
            "size": str(payload.get("size") or ""),
            "material": str(payload.get("material") or ""),
            "external_reference": str(payload.get("external_reference") or ""),
            "organization_id": organization_id,
            "owner_organization_id": str(
                payload.get("owner_organization_id") or organization_id
            ),
            "owner_code": str(owner_code or ""),
            "item_code": str(item_code or ""),
            "batch_id": str(payload.get("batch_id") or ""),
            "manufacturer_id": str(payload.get("manufacturer_id") or ""),
            "model_id": str(payload.get("model_id") or ""),
            "tag_status": ACTIVE,
            "status": ACTIVE,
            "assigned_at": utc_now(),
            "wash_cycles": 0,
            "created_at": utc_now(),
        }

    async def create_item(self, payload: dict, principal: dict) -> dict:
        organization_id = self._organization(payload, principal)
        prefix, length = self._epc_config()
        item_type = str(payload.get("item_type") or payload.get("category") or "")
        category = str(payload.get("category") or "")
        owner_code = await self._owner_code(organization_id, payload)
        code = structured_item_code(category, item_type)
        try:
            start_number = int(payload.get("start_number") or 1)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid start number") from exc
        if not 1 <= start_number <= MAX_LINEN_SEQUENCE:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Start number must be between 1 and {MAX_LINEN_SEQUENCE}",
            )
        sequence = await self.repository.next_sequence(
            f"linen_item:{organization_id}:{code}:{owner_code}", start_number
        )
        try:
            linen_id = structured_linen_id(category, item_type, owner_code, sequence)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
        qr_raw = str(payload.get("qr_id") or "").strip()
        if qr_raw:
            try:
                qr_id = normalize_qr(qr_raw)
            except ValueError as exc:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
            if not is_valid_structured_id(qr_id):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "QR identifier must use the current tag format",
                )
        else:
            qr_id = linen_id
        epc_raw = str(payload.get("epc") or "").strip()
        epc = normalize_epc(epc_raw, length) if epc_raw else generate_epc(sequence, prefix, length)
        # Tag serials identify a physical label across the whole deployment, so
        # they use their own global counter. The linen sequence is scoped per
        # hotel and item, and two hotels may legitimately both start at 1.
        serial_sequence = await self.repository.next_sequence("tag_serial")
        serial = str(payload.get("tag_serial") or "").strip() or new_tag_serial(serial_sequence)
        tid = normalize_tid(str(payload.get("tid") or ""))

        await self._unique_qr(qr_id)
        await self._unique_epc(epc)
        if await self.repository.find_by_tag_serial(serial) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Tag serial {serial} is already assigned")

        item = self._item_document(
            linen_id=linen_id,
            qr_id=qr_id,
            epc=epc,
            serial=serial,
            tid=tid,
            organization_id=organization_id,
            payload=payload,
            owner_code=owner_code,
            item_code=code,
        )
        saved = await self.repository.save_item(item)
        await self.repository.save_assignment(
            {
                "assignment_id": f"asg-{linen_id}-{sequence}",
                "linen_id": linen_id,
                "organization_id": organization_id,
                "identifier_type": "qr+epc",
                "qr_id": qr_id,
                "epc": epc,
                "tag_serial": serial,
                "actor_id": str(principal.get("actor_id") or ""),
                "action": "ASSIGNED",
            }
        )
        await self.outbox.publish(
            new_event(
                "identity.item.created",
                organization_id,
                "tag-management",
                linen_id,
                {"qr_id": qr_id, "epc": epc, "batch_id": item["batch_id"]},
            )
        )
        return saved

    async def bulk_create(self, rows: list[dict], principal: dict) -> dict:
        created: list[dict] = []
        failures: list[dict] = []
        for index, row in enumerate(rows):
            try:
                created.append(await self.create_item(row, principal))
            except (HTTPException, ValueError) as exc:
                detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
                failures.append({"row": index, "error": str(detail)})
        return {"created": len(created), "failed": len(failures), "failures": failures}

    async def resolve_qr(self, value: str, principal: dict) -> dict:
        identifier = normalize_qr(value)
        if not is_valid_structured_id(identifier):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Unsupported tag code format"
            )
        item = await self.repository.find_by_qr(identifier)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown QR identifier")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        return public_qr_view(item)

    async def resolve_epc(self, value: str, principal: dict) -> dict:
        _, length = self._epc_config()
        epc = normalize_epc(value, length)
        item = await self.repository.find_by_epc(epc)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown RFID EPC")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        return {
            "linen_id": item["linen_id"],
            "qr_id": item["qr_id"],
            "item_type": item.get("item_type", ""),
            "status": item.get("status", ACTIVE),
        }

    async def validate_mapping_import(
        self,
        rows: list[dict],
        batch_id: str,
        expected_quantity: int | None = None,
    ) -> dict:
        """Verify every mapping before any record may be activated."""

        errors: list[dict] = []
        normalized: list[dict] = []
        qr_seen: set[str] = set()
        epc_seen: set[str] = set()
        linen_seen: set[str] = set()
        _, length = self._epc_config()

        for index, row in enumerate(rows):
            missing = [field for field in REQUIRED_MAPPING_FIELDS if not row.get(field)]
            if missing:
                errors.append({"row": index, "error": f"Missing fields: {', '.join(missing)}"})
                continue
            try:
                linen_id = str(row["linen_id"]).strip().upper()
                qr_id = normalize_qr(row["qr_id"])
                epc = normalize_epc(row["epc"], length)
            except ValueError as exc:
                errors.append({"row": index, "error": str(exc)})
                continue
            for label, value, seen in (
                ("linen_id", linen_id, linen_seen),
                ("qr_id", qr_id, qr_seen),
                ("epc", epc, epc_seen),
            ):
                if value in seen:
                    errors.append({"row": index, "error": f"Duplicate {label}: {value}"})
                seen.add(value)
            if await self.repository.find_by_epc(epc) is not None:
                errors.append({"row": index, "error": f"EPC already assigned: {epc}"})
            normalized.append(
                {
                    "linen_id": linen_id,
                    "qr_id": qr_id,
                    "epc": epc,
                    "tag_serial": str(row.get("tag_serial") or ""),
                    "tid": normalize_tid(str(row.get("tid") or "")),
                    "item_type": str(row.get("item_type") or ""),
                    "organization_id": str(row.get("organization_id") or ""),
                }
            )

        if expected_quantity is not None and len(normalized) != expected_quantity:
            errors.append(
                {
                    "row": None,
                    "error": f"Expected {expected_quantity} records but received {len(normalized)}",
                }
            )
        return {
            "valid": not errors,
            "row_count": len(normalized),
            "errors": errors,
            "rows": normalized,
        }

    async def save_import(
        self, batch_id: str, rows: list[dict], expected_quantity: int | None, principal: dict
    ) -> dict:
        report = await self.validate_mapping_import(rows, batch_id, expected_quantity)
        batch = await self.repository.get_batch(batch_id)
        organization_id = str(
            (batch or {}).get("organization_id")
            or next((row.get("organization_id") for row in report["rows"] if row.get("organization_id")), "")
        )
        if not is_platform_admin(principal):
            assert_organization_access(principal, organization_id)
        self._assert_mapping_organization(report["rows"], organization_id, principal)
        sequence = await self.repository.next_sequence("tag_import")
        import_id = f"IMP-{sequence:06d}"
        document = {
            "import_id": import_id,
            "batch_id": batch_id,
            "organization_id": organization_id,
            "expected_quantity": expected_quantity,
            "row_count": report["row_count"],
            "valid": report["valid"],
            "errors": report["errors"],
            "rows": report["rows"],
            "status": "VERIFIED" if report["valid"] else "REJECTED",
            "actor_id": str(principal.get("actor_id") or ""),
            "created_at": utc_now(),
        }
        return await self.repository.save_import(document)

    async def activate_import(self, import_id: str, principal: dict) -> dict:
        document = await self.repository.get_import(import_id)
        if document is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Import not found")
        if document.get("status") != "VERIFIED" or not document.get("valid"):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Unverified tag mappings cannot be activated"
            )
        batch = await self.repository.get_batch(str(document.get("batch_id") or ""))
        if batch is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag batch not found")
        if str(batch.get("status")) != BATCH_VERIFIED:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Tag batch must be verified before activation"
            )
        batch_organization_id = str(batch.get("organization_id") or "")
        document_organization_id = str(document.get("organization_id") or "")
        organization_id = (
            batch_organization_id
            or document_organization_id
            or str(next((row.get("organization_id") for row in document["rows"] if row.get("organization_id")), ""))
        )
        if not is_platform_admin(principal):
            assert_organization_access(principal, batch_organization_id)
            assert_organization_access(principal, document_organization_id)
            if document_organization_id and document_organization_id != batch_organization_id:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Tag import belongs to another organization",
                )
        self._assert_mapping_organization(document["rows"], organization_id, principal)
        prefix, length = self._epc_config()
        activated = 0
        for row in document["rows"]:
            sequence = await self.repository.next_sequence("linen_item")
            epc = normalize_epc(row["epc"], length)
            await self._unique_epc(epc)
            qr_id = normalize_qr(row["qr_id"])
            await self._unique_qr(qr_id)
            item = self._item_document(
                linen_id=row["linen_id"],
                qr_id=qr_id,
                epc=epc,
                serial=row.get("tag_serial") or new_tag_serial(sequence),
                tid=row.get("tid", ""),
                organization_id=organization_id,
                payload=row,
            )
            item["batch_id"] = batch["batch_id"]
            await self.repository.save_item(item)
            activated += 1
        document["status"] = "ACTIVATED"
        document["activated_at"] = utc_now()
        await self.repository.save_import(document)
        batch["status"] = BATCH_ACTIVE
        batch["activated_quantity"] = activated
        await self.repository.save_batch(batch)
        await self.outbox.publish(
            new_event(
                "tag.batch.activated",
                str(batch.get("organization_id") or ""),
                "tag-management",
                batch["batch_id"],
                {"import_id": import_id, "activated": activated},
            )
        )
        return {
            "import_id": import_id,
            "activated": activated,
            "batch_id": batch["batch_id"],
        }

    async def replace_tag(self, linen_id: str, payload: dict, principal: dict) -> dict:
        item = await self.repository.get_item(linen_id)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        reason = str(payload.get("reason") or "").strip()
        if not reason:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A replacement reason is required")
        prefix, length = self._epc_config()
        old_epc = str(item.get("epc") or "")
        old_qr = str(item.get("qr_id") or "")
        new_epc_raw = str(payload.get("new_epc") or "").strip()
        new_epc = (
            normalize_epc(new_epc_raw, length)
            if new_epc_raw
            else generate_epc(await self.repository.next_sequence("epc"), prefix, length)
        )
        if new_epc != old_epc:
            await self._unique_epc(new_epc)
        new_qr = normalize_qr(payload.get("new_qr") or old_qr)
        if new_qr != old_qr:
            await self._unique_qr(new_qr)
        sequence = await self.repository.next_sequence("tag_replacement")
        replacement = {
            "replacement_id": f"REP-{sequence:06d}",
            "linen_id": linen_id,
            "old_epc": old_epc,
            "new_epc": new_epc,
            "old_qr": old_qr,
            "new_qr": new_qr,
            "reason": reason,
            "actor_id": str(principal.get("actor_id") or ""),
            "created_at": utc_now(),
        }
        await self.repository.save_replacement(replacement)
        await self.repository.save_assignment(
            {
                "assignment_id": f"asg-{sequence:06d}-end",
                "linen_id": linen_id,
                "identifier_type": "epc",
                "epc": old_epc,
                "action": "DEACTIVATED",
                "reason": reason,
                "actor_id": replacement["actor_id"],
            }
        )
        item["epc"] = new_epc
        item["qr_id"] = new_qr
        item["qr_url"] = qr_payload(self._base_url(), new_qr)
        item["tag_serial"] = str(payload.get("new_tag_serial") or "") or item.get("tag_serial", "")
        item["tid"] = normalize_tid(str(payload.get("new_tid") or "")) or item.get("tid", "")
        item["tag_status"] = ACTIVE
        item["updated_at"] = utc_now()
        saved = await self.repository.save_item(item)
        await self.repository.save_assignment(
            {
                "assignment_id": f"asg-{sequence:06d}-start",
                "linen_id": linen_id,
                "identifier_type": "epc",
                "epc": new_epc,
                "action": "ASSIGNED",
                "reason": reason,
                "actor_id": replacement["actor_id"],
            }
        )
        await self.outbox.publish(
            new_event(
                "tag.replaced",
                str(item.get("organization_id") or ""),
                "tag-management",
                linen_id,
                {"old_epc": old_epc, "new_epc": new_epc, "reason": reason},
            )
        )
        return {"replacement": replacement, "item": saved}

    async def record_wash_cycle(self, linen_id: str, wash_count: int) -> dict | None:
        """Keep identity-side advisory wash count in step with validated cycles."""

        item = await self.repository.get_item(linen_id)
        if item is None:
            return None
        item["wash_cycles"] = int(wash_count)
        item["updated_at"] = utc_now()
        return await self.repository.save_item(item)

    async def deactivate_tag(self, linen_id: str, payload: dict, principal: dict) -> dict:
        item = await self.repository.get_item(linen_id)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        item["tag_status"] = INACTIVE
        item["status"] = INACTIVE
        item["deactivated_at"] = utc_now()
        item["deactivation_reason"] = str(payload.get("reason") or "")
        saved = await self.repository.save_item(item)
        await self.outbox.publish(
            new_event(
                "tag.deactivated",
                str(item.get("organization_id") or ""),
                "tag-management",
                linen_id,
                {"epc": item.get("epc", ""), "reason": item["deactivation_reason"]},
            )
        )
        return saved

    async def tag_history(self, linen_id: str, principal: dict) -> dict:
        item = await self.repository.get_item(linen_id)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        return {
            "item": item,
            "assignments": await self.repository.list_assignments(linen_id),
            "replacements": await self.repository.list_replacements(linen_id),
        }

    async def save_batch(self, payload: dict, principal: dict) -> dict:
        if not is_platform_admin(principal):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform administrator access required")
        batch_id = str(payload.get("batch_id") or "").strip()
        if not batch_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "batch_id is required")
        expected = int(payload.get("expected_quantity") or 0)
        if expected <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "expected_quantity must be positive")
        batch = {
            "batch_id": batch_id,
            "organization_id": str(payload.get("organization_id") or ""),
            "manufacturer_id": str(payload.get("manufacturer_id") or ""),
            "model_id": str(payload.get("model_id") or ""),
            "supplier_id": str(payload.get("supplier_id") or ""),
            "manufacturer": str(payload.get("manufacturer") or ""),
            "model": str(payload.get("model") or ""),
            "technology": str(payload.get("technology") or "QR+UHF RFID"),
            "durability_rating_cycles": int(payload.get("durability_rating_cycles") or 0),
            "country_of_origin": str(payload.get("country_of_origin") or ""),
            "supplier": str(payload.get("supplier") or ""),
            "purchase_order": str(payload.get("purchase_order") or ""),
            "quotation_reference": str(payload.get("quotation_reference") or ""),
            "unit_price": float(payload.get("unit_price") or 0),
            "import_cost": float(payload.get("import_cost") or 0),
            "customs_cost": float(payload.get("customs_cost") or 0),
            "shipping_cost": float(payload.get("shipping_cost") or 0),
            "expected_quantity": expected,
            "received_quantity": int(payload.get("received_quantity") or 0),
            "rejected_quantity": int(payload.get("rejected_quantity") or 0),
            "warranty_reference": str(payload.get("warranty_reference") or ""),
            "quality_inspection": dict(payload.get("quality_inspection") or {}),
            "sample_testing": dict(payload.get("sample_testing") or {}),
            "status": str(payload.get("status") or "RECEIVED"),
            "created_at": utc_now(),
        }
        return await self.repository.save_batch(batch)

    async def verify_batch(self, batch_id: str, principal: dict) -> dict:
        if not is_platform_admin(principal):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform administrator access required")
        batch = await self.repository.get_batch(batch_id)
        if batch is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Tag batch not found")
        accepted = int(batch.get("received_quantity") or 0) - int(batch.get("rejected_quantity") or 0)
        if accepted <= 0:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Batch has no accepted quantity to verify"
            )
        if accepted != int(batch.get("expected_quantity") or 0):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Received minus rejected quantity must equal the expected quantity",
            )
        batch["status"] = BATCH_VERIFIED
        batch["verified_at"] = utc_now()
        return await self.repository.save_batch(batch)

    async def save_manufacturer(self, payload: dict, principal: dict) -> dict:
        if not is_platform_admin(principal):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform administrator access required")
        row = dict(payload)
        row.setdefault("manufacturer_id", f"MFG-{row.get('name', '').upper()[:12]}")
        row.setdefault("created_at", utc_now())
        return await self.repository.save_manufacturer(row)

    async def save_model(self, payload: dict, principal: dict) -> dict:
        if not is_platform_admin(principal):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform administrator access required")
        row = dict(payload)
        row.setdefault("model_id", f"MOD-{row.get('name', '').upper()[:12]}")
        row.setdefault("created_at", utc_now())
        return await self.repository.save_model(row)

    async def list_items(
        self,
        principal: dict,
        organization_id: str | None = None,
        batch_id: str | None = None,
        status: str | None = None,
        limit: int = 200,
    ) -> list[dict]:
        if organization_id:
            assert_organization_access(principal, organization_id)
        elif not is_platform_admin(principal):
            scopes = sorted(set(principal.get("organization_ids") or []))
            if len(scopes) == 1:
                organization_id = scopes[0]
            elif not scopes:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN, "Organization scope is required"
                )
        rows = await self.repository.list_items(
            organization_id=organization_id,
            batch_id=batch_id,
            status=status,
            limit=min(limit, 500),
        )
        if not is_platform_admin(principal):
            scopes = set(principal.get("organization_ids") or [])
            rows = [row for row in rows if row.get("organization_id") in scopes]
        return rows

    async def get_item(self, linen_id: str, principal: dict) -> dict:
        item = await self.repository.get_item(linen_id)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        return item

    async def list_batches(self, principal: dict, limit: int = 200) -> list[dict]:
        if not is_platform_admin(principal):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform administrator access required")
        return await self.repository.list_batches(limit=min(limit, 500))

    async def get_import(self, import_id: str, principal: dict) -> dict:
        document = await self.repository.get_import(import_id)
        if document is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Import not found")
        if not is_platform_admin(principal):
            assert_organization_access(
                principal, str(document.get("organization_id") or "")
            )
        return document

    async def save_supplier(self, payload: dict, principal: dict) -> dict:
        if not is_platform_admin(principal):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform administrator access required")
        row = dict(payload)
        row.setdefault("supplier_id", f"SUP-{row.get('name', '').upper()[:12]}")
        row.setdefault("created_at", utc_now())
        return await self.repository.save_supplier(row)

    async def list_suppliers(self, principal: dict, limit: int = 200) -> list[dict]:
        return await self.repository.list_suppliers(limit=min(limit, 500))

    async def list_manufacturers(self, principal: dict, limit: int = 200) -> list[dict]:
        return await self.repository.list_manufacturers(limit=min(limit, 500))

    async def list_models(
        self, manufacturer_id: str | None, principal: dict, limit: int = 200
    ) -> list[dict]:
        return await self.repository.list_models(
            manufacturer_id=manufacturer_id, limit=min(limit, 500)
        )

    async def generate_tag_sheet(self, linen_ids: list[str], principal: dict) -> str:
        """Return an SVG tag sheet for the selected items (one QR per linen item)."""

        import html

        from .qr import render_qr_svg

        cells: list[str] = []
        for linen_id in linen_ids:
            item = await self.repository.get_item(linen_id)
            if item is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, f"Linen item {linen_id} not found")
            assert_organization_access(principal, str(item.get("organization_id") or ""))
            svg = render_qr_svg(item["qr_url"])
            cells.append(
                f'<g transform="translate({len(cells) % 4 * 260},{len(cells) // 4 * 180})">'
                f"{svg}"
                f'<text x="0" y="164" font-family="monospace" font-size="12">'
                f"{html.escape(item['linen_id'])}</text>"
                f'<text x="0" y="178" font-family="monospace" font-size="9">'
                f"{html.escape(item['epc'])}</text></g>"
            )
        width = 4 * 260
        height = max(1, (len(cells) + 3) // 4) * 180
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">'
            f'<rect width="100%" height="100%" fill="white"/>{"".join(cells)}</svg>'
        )
