from datetime import datetime, timezone


def now() -> datetime:
    return datetime.now(timezone.utc)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def current_period() -> str:
    return now().strftime("%Y-%m")
