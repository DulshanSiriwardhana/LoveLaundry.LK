from .adjustments import router as adjustments_router
from .bills import router as bills_router
from .billing import router as billing_router
from .dashboards import router as dashboards_router
from .events import router as events_router
from .identity import router as identity_router
from .health import router as health_router
from .integration import router as integration_router
from .linen import router as linen_router
from .linen_lifecycle import router as linen_lifecycle_router
from .notifications import router as notifications_router
from .platform import router as platform_router
from .rfid import router as rfid_router
from .scanning import router as scanning_router

__all__ = [
    "adjustments_router",
    "bills_router",
    "billing_router",
    "dashboards_router",
    "events_router",
    "identity_router",
    "health_router",
    "integration_router",
    "linen_router",
    "linen_lifecycle_router",
    "notifications_router",
    "platform_router",
    "rfid_router",
    "scanning_router",
]
