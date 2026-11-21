"""Normalized security principal shared by every production endpoint.

The live user-service emits JWTs with ``user_id``/``auth_id``, ``role``,
``laundry_id``, ``laundries``, ``hotel_id``, ``hotels``, ``shop_id`` and
``shops``. The earlier production rebuild expected ``sub``, ``role_ids`` and
``permissions``. Both shapes are accepted here, but the resulting principal has
one canonical shape that authorization code can trust.
"""

from __future__ import annotations

from typing import Iterable

ALL_CAPABILITIES = frozenset(
    {
        "view_bills",
        "edit_bills",
        "view_invoices",
        "issue_invoices",
        "record_payments",
        "view_reports",
        "export_reports",
        "view_linen",
        "edit_linen",
        "record_scans",
        "view_manifests",
        "manage_manifests",
        "view_events",
        "retry_events",
        "view_operations",
        "view_adjustments",
        "edit_adjustments",
        "approve_adjustments",
        "manage_organizations",
        "manage_users",
        "manage_settings",
        "view_notifications",
        "view_tags",
        "manage_tags",
        "manage_tag_batches",
        "manage_readers",
        "view_scan_sessions",
        "manage_scan_sessions",
        "view_dashboards",
        "platform_admin",
    }
)

_OPERATIONS = frozenset(
    {
        "view_bills",
        "edit_bills",
        "view_invoices",
        "issue_invoices",
        "record_payments",
        "view_reports",
        "export_reports",
        "view_linen",
        "edit_linen",
        "record_scans",
        "view_manifests",
        "manage_manifests",
        "view_events",
        "retry_events",
        "view_operations",
        "view_adjustments",
        "edit_adjustments",
        "approve_adjustments",
        "view_notifications",
        "view_tags",
        "manage_tags",
        "manage_tag_batches",
        "manage_readers",
        "view_scan_sessions",
        "manage_scan_sessions",
        "view_dashboards",
    }
)

_READ_ONLY_OPERATIONS = frozenset(
    {
        "view_bills",
        "view_invoices",
        "view_reports",
        "view_operations",
        "view_linen",
        "record_scans",
        "view_manifests",
        "view_adjustments",
        "edit_adjustments",
        "view_notifications",
        "view_tags",
        "view_scan_sessions",
        "view_dashboards",
    }
)

_CLIENT_OPERATIONS = frozenset(
    {
        "view_linen",
        "record_scans",
        "view_manifests",
        "view_reports",
        "view_notifications",
        "view_tags",
        "view_scan_sessions",
    }
)

ROLE_CAPABILITIES: dict[str, frozenset[str]] = {
    "PLATFORM_ADMIN": ALL_CAPABILITIES,
    "SUPER_ADMIN": ALL_CAPABILITIES,
    "ADMIN": _OPERATIONS,
    "MANAGER": _OPERATIONS,
    "LAUNDRY_ADMIN": _OPERATIONS,
    "STAFF": _READ_ONLY_OPERATIONS,
    "HOTEL_ADMIN": _CLIENT_OPERATIONS,
    "HOTEL_MANAGER": _CLIENT_OPERATIONS,
    "HOTEL_STAFF": _CLIENT_OPERATIONS,
    "SHOP_ADMIN": _CLIENT_OPERATIONS,
    "SHOP_STAFF": _CLIENT_OPERATIONS,
}


def _names(values) -> set[str]:
    result: set[str] = set()
    if isinstance(values, str):
        values = [values]
    if isinstance(values, (list, tuple, set)):
        for value in values:
            if isinstance(value, str) and value.strip():
                result.add(value.strip().upper())
            elif isinstance(value, dict):
                role = value.get("role") or value.get("role_id") or value.get("name")
                if isinstance(role, str) and role.strip():
                    result.add(role.strip().upper())
    return result


def _ids(values) -> set[str]:
    result: set[str] = set()
    if isinstance(values, str):
        values = [values]
    if isinstance(values, (list, tuple, set)):
        for value in values:
            if isinstance(value, str) and value.strip():
                result.add(value.strip())
            elif isinstance(value, dict):
                identifier = value.get("id") or value.get("organization_id")
                if isinstance(identifier, str) and identifier.strip():
                    result.add(identifier.strip())
    return result


def _first(value) -> str:
    if isinstance(value, str):
        return value.strip()
    return ""


def normalize_principal(user: dict, claims: dict | None = None) -> dict:
    claims = claims or {}
    source = {**claims, **user}

    auth_id = (
        _first(source.get("auth_id"))
        or _first(source.get("sub"))
        or _first(source.get("user_id"))
        or _first(source.get("user_name"))
    )
    if not auth_id:
        raise ValueError("Authenticated principal has no stable identifier")

    roles = _names(source.get("role_ids")) | _names(source.get("role")) | _names(
        source.get("roles")
    )
    if "PLATFORM_ADMIN" in roles:
        roles.add("ADMIN")

    capabilities = set(source.get("permissions") or [])
    if "*" in capabilities:
        capabilities = set(ALL_CAPABILITIES)
    for role in roles:
        capabilities |= ROLE_CAPABILITIES.get(role, frozenset())
    if bool(source.get("platform_admin")):
        capabilities |= ALL_CAPABILITIES

    organization_id = _first(source.get("organization_id")) or _first(
        source.get("laundry_id")
    )
    organization_ids = _ids(source.get("organization_ids")) | _ids(
        source.get("laundries")
    )
    if organization_id:
        organization_ids.add(organization_id)

    scoped_ids: dict[str, set[str]] = {}
    for kind in ("laundry", "hotel", "shop"):
        singular = _first(source.get(f"{kind}_id"))
        plural = _ids(source.get(f"{kind}s"))
        if singular:
            plural.add(singular)
        scoped_ids[kind] = plural

    # Client roles are scoped to their hotel or shop rather than a laundry.
    # Include those entity IDs in the general organization scope so resource
    # repositories can apply one consistent predicate.
    for kind in ("hotel", "shop"):
        organization_ids |= scoped_ids[kind]
    if not organization_id:
        organization_id = _first(source.get("hotel_id")) or _first(source.get("shop_id"))

    return {
        "actor_id": auth_id,
        "auth_id": auth_id,
        "user_id": _first(source.get("user_id")) or auth_id,
        "user_name": _first(source.get("user_name")) or auth_id,
        "status": _first(source.get("status")) or "active",
        "role_names": sorted(roles),
        "capabilities": sorted(capabilities),
        "organization_id": organization_id,
        "organization_ids": sorted(organization_ids),
        "laundry_id": _first(source.get("laundry_id")),
        "hotel_id": _first(source.get("hotel_id")),
        "shop_id": _first(source.get("shop_id")),
        "laundry_ids": sorted(scoped_ids["laundry"]),
        "hotel_ids": sorted(scoped_ids["hotel"]),
        "shop_ids": sorted(scoped_ids["shop"]),
        "platform_admin": bool(source.get("platform_admin")) or "PLATFORM_ADMIN" in roles,
        "support_entry": bool(source.get("support_entry")),
    }


def is_platform_admin(principal: dict) -> bool:
    return bool(principal.get("platform_admin")) or "platform_admin" in (
        principal.get("capabilities") or []
    )


def granted_capabilities(principal: dict) -> set[str]:
    return set(principal.get("capabilities") or [])


def scoped_organization_ids(principal: dict) -> set[str]:
    return set(principal.get("organization_ids") or [])


def organization_ids_for(principal: dict, kind: str | None = None) -> set[str]:
    if kind:
        return set(principal.get(f"{kind}_ids") or [])
    return scoped_organization_ids(principal)


def repository_scope(principal: dict, requested: str | None = None) -> str | list[str] | None:
    """Return the organization predicate value a repository should apply."""

    from fastapi import HTTPException, status

    if is_platform_admin(principal):
        return requested or None
    if requested:
        assert_organization_access(principal, requested)
        return requested
    identifiers = scoped_organization_ids(principal)
    if len(identifiers) == 1:
        return next(iter(identifiers))
    if identifiers:
        return sorted(identifiers)
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Organization scope is required")


def assert_organization_access(principal: dict, organization_id: str | None) -> None:
    """Raise HTTP 403 when the authenticated principal may not touch an org.

    Platform admins are global. Every other role must present a non-empty
    organization id that appears in its signed token/database scope.
    """

    from fastapi import HTTPException, status

    if is_platform_admin(principal):
        return
    requested = _first(organization_id)
    if not requested:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Organization scope is required")
    if requested not in scoped_organization_ids(principal):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Resource belongs to another organization"
        )
