from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
async def root() -> dict:
    return {"service": "production-backend", "status": "ok"}


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}
