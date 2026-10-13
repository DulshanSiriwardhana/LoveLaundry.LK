"""
SECONDARY database — verification/replica database.

This database may ONLY be written by the synchronization service and
read by the verification service. It must NEVER be used as the normal
frontend data source.
"""
from ._proxy import register
from .connection_manager import ROLE_SECONDARY

bills_collection = register(ROLE_SECONDARY, "bills")
gatepasses_collection = register(ROLE_SECONDARY, "gatepasses")
deliveries_collection = register(ROLE_SECONDARY, "deliveries")
dispatch_jobs_collection = register(ROLE_SECONDARY, "dispatch_jobs")
payments_collection = register(ROLE_SECONDARY, "payments")
audit_collection = register(ROLE_SECONDARY, "audit_logs")
linens_collection = register(ROLE_SECONDARY, "linens")
linen_events_collection = register(ROLE_SECONDARY, "linen_events")
shop_bills_collection = register(ROLE_SECONDARY, "shop_bills")
bill_templates_collection = register(ROLE_SECONDARY, "bill_templates")
legacy_invoices_collection = register(ROLE_SECONDARY, "legacy_invoices")

# Sync metadata is mirrored too, so verification can compare records
# entirely within the Secondary database.
sync_status_collection = register(ROLE_SECONDARY, "sync_status")
