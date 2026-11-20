def currency(amount: float) -> str:
    return f"{amount:,.2f}"


def today_key(value: str | None = None) -> str:
    from datetime import datetime, timezone

    return (datetime.now(timezone.utc) if value is None else datetime.fromisoformat(value)).strftime(
        "%Y-%m-%d"
    )


def new_id(prefix: str) -> str:
    import uuid

    return f"{prefix}-{uuid.uuid4().hex[:12]}"
