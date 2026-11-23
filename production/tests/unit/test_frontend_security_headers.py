"""Guard the deployed security headers and inline-script CSP hashes.

The Vite theme bootstrap scripts are inline in index.html. A hash-based
script-src is only safe if those hashes stay in sync with the file, so this
test fails when either side drifts.
"""

import base64
import hashlib
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]

APP_DIRS = [
    "production/apps/hotel-app",
    "production/apps/hotel-scanner",
    "production/apps/shop-app",
    "production/apps/laundry-internal",
    "production/apps/laundry-scanner",
    "production/apps/linen-room-app",
    "production/apps/linen-tracking",
    "production/apps/platform-admin",
    "production/apps/public-site",
    "public.lovelaundry.lk",
    "architecture_updated_system/frontend",
    "architecture_updated_system/system_info/frontend",
    "client-pub",
    "mobile-app",
    "system-manegment/quotations-ui",
    "system-managment/quotations-ui",
    "system-manegment/release/edition-v1/quotations-ui",
    "system-manegment/release/edition-v1/public.lovelaundry.lk",
    "system-manegment/release/edition-v2/apps/hotel-scanner",
    "system-manegment/release/edition-v2/apps/laundry-internal",
    "system-manegment/release/edition-v2/apps/laundry-scanner",
    "system-manegment/release/edition-v2/apps/linen-tracking",
    "system-manegment/release/edition-v2/apps/platform-admin",
    "system-manegment/release/edition-v2/apps/public-site",
]
NGINX_CONFIGS = {
    "system-manegment/quotations-ui/nginx/default.conf": "system-manegment/quotations-ui/index.html",
    "system-managment/quotations-ui/nginx/default.conf": "system-managment/quotations-ui/index.html",
    "system-manegment/release/edition-v1/quotations-ui/nginx/default.conf": "system-manegment/release/edition-v1/quotations-ui/index.html",
    "production/apps/platform-admin/nginx.conf": "production/apps/platform-admin/index.html",
    "architecture_updated_system/frontend/nginx.conf": "architecture_updated_system/frontend/index.html",
    "architecture_updated_system/system_info/frontend/nginx.conf": "architecture_updated_system/system_info/frontend/index.html",
    "system-manegment/release/edition-v2/apps/platform-admin/nginx.conf": "system-manegment/release/edition-v2/apps/platform-admin/index.html",
}


def inline_script_hashes(index_path: Path) -> set[str]:
    text = index_path.read_text(encoding="utf-8")
    return {
        "sha256-" + base64.b64encode(hashlib.sha256(match.group(1).encode()).digest()).decode()
        for match in re.finditer(
            r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", text, re.S
        )
    }


def header_map(config: dict) -> dict[str, str]:
    headers = next(group["headers"] for group in config["headers"] if group["source"] == "/(.*)")
    return {item["key"]: item["value"] for item in headers}


@pytest.mark.parametrize("relative", APP_DIRS)
def test_vercel_security_headers_and_csp_hashes(relative: str) -> None:
    app = ROOT / relative
    config = json.loads((app / "vercel.json").read_text(encoding="utf-8"))
    headers = header_map(config)

    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert "max-age=31536000" in headers["Strict-Transport-Security"]
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    assert "'unsafe-inline'" not in headers["Content-Security-Policy"].split("script-src")[1].split(";")[0]

    configured = set(re.findall(r"'sha256-[^']+'", headers["Content-Security-Policy"]))
    assert configured == {"'" + value + "'" for value in inline_script_hashes(app / "index.html")}


@pytest.mark.parametrize("relative", sorted(NGINX_CONFIGS))
def test_nginx_security_headers_and_csp_hashes(relative: str) -> None:
    text = (ROOT / relative).read_text(encoding="utf-8")
    assert "add_header X-Frame-Options DENY always;" in text
    assert "Strict-Transport-Security" in text
    csp_line = next(line for line in text.splitlines() if "Content-Security-Policy" in line)
    assert "frame-ancestors 'none'" in csp_line

    configured = set(re.findall(r"'sha256-[^']+'", csp_line))
    assert configured == {
        "'" + value + "'" for value in inline_script_hashes(ROOT / NGINX_CONFIGS[relative])
    }
