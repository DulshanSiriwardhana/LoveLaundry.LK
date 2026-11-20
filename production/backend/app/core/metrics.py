import threading
import time
from collections import defaultdict

_STARTED_AT = time.monotonic()
_LOCK = threading.Lock()
_REQUESTS: dict[tuple[str, int], int] = defaultdict(int)


def record_request(method: str, status_code: int) -> None:
    with _LOCK:
        _REQUESTS[(method, status_code)] += 1


def render_prometheus() -> str:
    with _LOCK:
        rows = dict(_REQUESTS)
        uptime = time.monotonic() - _STARTED_AT
    lines = [
        "# HELP lovelaundry_http_requests_total Total HTTP requests handled.",
        "# TYPE lovelaundry_http_requests_total counter",
    ]
    for (method, status), count in sorted(rows.items()):
        lines.append(
            f'lovelaundry_http_requests_total{{method="{method}",status="{status}"}} {count}'
        )
    lines.extend(
        [
            "# HELP lovelaundry_uptime_seconds Process uptime in seconds.",
            "# TYPE lovelaundry_uptime_seconds gauge",
            f"lovelaundry_uptime_seconds {uptime:.3f}",
        ]
    )
    return "\n".join(lines) + "\n"
