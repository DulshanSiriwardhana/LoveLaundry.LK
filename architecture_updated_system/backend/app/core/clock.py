"""Timezone-aware application clock (Sri Lankan business time).

Love Laundry operates only in Sri Lanka, so business-day boundaries, "today"
and month buckets use Asia/Colombo — a fixed UTC+05:30 offset with no DST.
That is why ``LKT`` is a ``timedelta`` rather than a ``ZoneInfo``: it needs no
tzdata package and behaves identically in a slim container, on Vercel (UTC) and
on a developer laptop.

Storage stays UTC; only the derivation of a calendar day from an instant is
timezone-sensitive. Do not use this for JWT ``exp`` or HMAC windows — those are
wire-level instants that stay UTC.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

#: Asia/Colombo — a fixed +05:30 offset, no DST.
LKT = timezone(timedelta(hours=5, minutes=30), "LKT")

#: Alias for call sites that read clearly next to ``LKT``.
UTC = timezone.utc

#: IANA name for Mongo ``$dateToString`` / ``$dateTrunc`` pipelines.
MONGO_TIME_ZONE = "Asia/Colombo"


def now() -> datetime:
    """Current time, timezone-aware, on the Sri Lankan clock."""
    return datetime.now(LKT)


def utcnow() -> datetime:
    return datetime.now(UTC)


def app_tz():
    return LKT


# ── Business calendar ───────────────────────────────────────────────────────
def today() -> date:
    return datetime.now(UTC).astimezone(LKT).date()


def today_str() -> str:
    return today().isoformat()


def this_month() -> str:
    return today().strftime("%Y-%m")


def this_year() -> int:
    return today().year


def this_month_number() -> int:
    return today().month


def lkt(value: datetime) -> datetime:
    """The same instant, expressed on the Sri Lankan clock.

    Naive input is read as UTC (how the DB hands it back when the Mongo codec is
    not configured); reinterpreting it as local time would shift historical rows.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).astimezone(LKT)
    return value.astimezone(LKT)


def day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=LKT)


def day_end(day: date) -> datetime:
    return datetime.combine(day, time(23, 59, 59), tzinfo=LKT)


def day_bounds(day: date) -> tuple[datetime, datetime]:
    start = day_start(day)
    return start, start + timedelta(days=1)


def parse_day(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def week_start(day: date) -> datetime:
    return day_start(day - timedelta(days=day.weekday()))


def month_start(year: int, month: int) -> datetime:
    return day_start(date(year, month, 1))


def month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = month_start(year, month)
    if month == 12:
        return start, month_start(year + 1, 1)
    return start, month_start(year, month + 1)


def year_bounds(year: int) -> tuple[datetime, datetime]:
    return day_start(date(year, 1, 1)), day_start(date(year + 1, 1, 1))


def add_months(day: date, months: int) -> date:
    total = (day.year * 12 + day.month - 1) + months
    year, month = divmod(total, 12)
    month += 1
    if month == 12:
        last = (date(year + 1, 1, 1) - timedelta(days=1)).day
    else:
        last = (date(year, month + 1, 1) - timedelta(days=1)).day
    return date(year, month, min(day.day, last))


def month_start_shift(months: int) -> datetime:
    """Midnight on the first day of the month ``months`` away from this one."""
    shifted = add_months(today().replace(day=1), months)
    return month_start(shifted.year, shifted.month)


def parse_wall_clock(value: str) -> datetime:
    """A user-entered ``YYYY-MM-DD`` read as *our* midnight, not UTC midnight."""
    return day_start(parse_day(value))


def wall_clock(value: datetime) -> datetime:
    """Interpret a submitted timestamp, defaulting naive input to Sri Lanka.

    An aware value already carries the right instant and is passed through;
    naive input (a legacy client that sent no offset) is read as *our* wall
    clock. Either way the result is aware, which is what gets stored.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=LKT)
    return value


def day_query(value: datetime) -> datetime:
    """Start-of-Sri-Lankan-day bound for a submitted date filter."""
    return day_start(lkt(value).date())


def day_query_end(value: datetime) -> datetime:
    """End-of-Sri-Lankan-day bound for a submitted date filter (inclusive)."""
    return day_end(lkt(value).date())


def lkt_date_str(value: datetime) -> str:
    return lkt(value).strftime("%Y-%m-%d")


def lkt_month_key(value: datetime) -> str:
    return lkt(value).strftime("%Y-%m")


def lkt_month_label(value: datetime) -> str:
    return lkt(value).strftime("%b %y")


def lkt_year(value: datetime) -> int:
    return lkt(value).year


def lkt_month_number(value: datetime) -> int:
    return lkt(value).month


def lkt_day_of_week(value: datetime) -> int:
    """Weekday 1-7 (Monday=1), matching Mongo's ``$dayOfWeek``, in Sri Lanka."""
    return lkt(value).isoweekday()


# ── Output stamps ───────────────────────────────────────────────────────────
def utc_iso_z() -> str:
    """UTC ISO-8601 with a ``Z`` suffix, for change-history string fields."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def stamp(value: datetime) -> str:
    """ISO-8601 for API output, carrying the explicit Sri Lankan offset."""
    return lkt(value).isoformat()


def naive_stamp(value: datetime) -> str:
    """``YYYY-MM-DD HH:MM:SS`` on the Sri Lankan clock, no offset suffix."""
    return lkt(value).strftime("%Y-%m-%d %H:%M:%S")
