"""
LOCAL database — admin-controlled replica.

Written ONLY when an authorized admin explicitly requests a local
synchronization (MAIN -> LOCAL). It is never a normal read source
and never writes back to MAIN.
"""
from ._proxy import register
from .connection_manager import ROLE_LOCAL

bills_collection = register(ROLE_LOCAL, "bills")
gatepasses_collection = register(ROLE_LOCAL, "gatepasses")
deliveries_collection = register(ROLE_LOCAL, "deliveries")
dispatch_jobs_collection = register(ROLE_LOCAL, "dispatch_jobs")
payments_collection = register(ROLE_LOCAL, "payments")
audit_collection = register(ROLE_LOCAL, "audit_logs")
linens_collection = register(ROLE_LOCAL, "linens")
linen_events_collection = register(ROLE_LOCAL, "linen_events")
shop_bills_collection = register(ROLE_LOCAL, "shop_bills")
bill_templates_collection = register(ROLE_LOCAL, "bill_templates")
legacy_invoices_collection = register(ROLE_LOCAL, "legacy_invoices")

# Mirror sync metadata so LOCAL sync can compare versions locally.
sync_status_collection = register(ROLE_LOCAL, "sync_status")
