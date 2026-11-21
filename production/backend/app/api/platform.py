from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..permissions.service import require_platform_admin
from ..runtime import get_runtime

router = APIRouter(prefix="/platform", tags=["platform-admin"])

_PLATFORM = Depends(require_platform_admin)


class AnnouncementRequest(BaseModel):
    announcement_id: str | None = None
    title: str = Field(min_length=1)
    body: str = Field(min_length=1)
    applications: list[str] = Field(default_factory=list)
    organization_ids: list[str] = Field(default_factory=list)
    role_names: list[str] = Field(default_factory=list)
    priority: str = "normal"
    starts_at: str = ""
    ends_at: str = ""
    enabled: bool = True


class ThemeRequest(BaseModel):
    settings_id: str | None = None
    scope: str = "global"
    organization_id: str = ""
    theme: dict = Field(default_factory=dict)
    status: str = "active"
    scheduled_for: str = ""
    expires_at: str = ""


@router.get("/summary", dependencies=[_PLATFORM])
async def platform_summary() -> dict:
    return await get_runtime().platform_service.summary()


@router.get("/organizations", dependencies=[_PLATFORM])
async def platform_organizations() -> list[dict]:
    return await get_runtime().platform_service.organizations()


@router.get("/announcements", dependencies=[_PLATFORM])
async def platform_announcements() -> list[dict]:
    return await get_runtime().platform_service.announcements()


@router.post("/announcements", dependencies=[_PLATFORM])
async def save_announcement(payload: AnnouncementRequest) -> dict:
    return await get_runtime().platform_service.save_announcement(payload.model_dump())


@router.get("/themes", dependencies=[_PLATFORM])
async def platform_themes() -> list[dict]:
    return await get_runtime().platform_service.themes()


@router.post("/themes", dependencies=[_PLATFORM])
async def save_theme(payload: ThemeRequest) -> dict:
    return await get_runtime().platform_service.save_theme(payload.model_dump())


@router.get("/audit", dependencies=[_PLATFORM])
async def platform_audit(limit: int = Query(default=200, ge=1, le=500)) -> list[dict]:
    return await get_runtime().platform_service.audit(limit)
