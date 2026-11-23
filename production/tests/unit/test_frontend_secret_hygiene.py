"""Regression tests: browser bundles must never contain the Love AI key.

The AI service supports two authentication modes. Internal service callers may
use an API key plus HMAC signature; browser clients must use the signed-in
user's JWT so the service can scope tenant data and the key stays server-side.
"""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]

QUOTATIONS_CHECKOUTS = [
    "system-manegment/quotations-ui",
    "system-managment/quotations-ui",
]
OTHER_WEB_APPS = [
    "production/apps/hotel-app",
    "production/apps/hotel-scanner",
    "production/apps/shop-app",
    "production/apps/laundry-internal",
    "production/apps/laundry-scanner",
    "production/apps/linen-room-app",
    "production/apps/linen-tracking",
    "production/apps/platform-admin",
    "system-manegment/release/edition-v1/quotations-ui",
    "system-manegment/release/edition-v2/apps/hotel-scanner",
]
MOBILE_APPS = [
    "system-managment/skaner",
    "system-manegment/skaner",
    "system-manegment/release/edition-v1/LoveMobi",
]
FORBIDDEN = (
    "VITE_AI_API_KEY",
    "hmacSha256Hex",
    "X-Signature",
    "X-API-Key",
)
# A generic HMAC helper used for idempotency keys is fine; signing an AI
# request with a service key from a shipped app is not.
MOBILE_FORBIDDEN = (
    "VITE_AI_API_KEY",
    "X-Signature",
    "X-API-Key",
    "hmacSha256Hex(key",
    "AppSettingsStore.aiKey",
)


def _web_source_files(app: Path) -> list[Path]:
    files = [path for path in app.rglob("*") if path.is_file()]
    files.extend([app / "Dockerfile", app / ".env.example"])
    return [
        path
        for path in files
        if "node_modules" not in path.parts
        and "dist" not in path.parts
        and ".git" not in path.parts
        and (
            path.suffix in {".ts", ".tsx", ".js", ".jsx", ".html", ".json"}
            or path.name in {"Dockerfile", ".env.example"}
        )
    ]


@pytest.mark.parametrize("relative", QUOTATIONS_CHECKOUTS + OTHER_WEB_APPS)
def test_no_service_key_or_client_hmac_in_web_apps(relative: str) -> None:
    app = ROOT / relative
    assert app.is_dir(), f"missing frontend checkout: {relative}"

    offenders: list[str] = []
    for path in _web_source_files(app):
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for marker in FORBIDDEN:
            if marker in text:
                offenders.append(f"{path.relative_to(ROOT)}: contains {marker}")

    assert not offenders, "\n".join(offenders)


@pytest.mark.parametrize("relative", QUOTATIONS_CHECKOUTS)
def test_quotations_ai_client_uses_browser_jwt(relative: str) -> None:
    client = (
        ROOT / relative / "src" / "features" / "ai" / "api" / "ai-api.ts"
    ).read_text(encoding="utf-8")

    assert "getActiveToken" in client
    assert "Authorization: `Bearer ${token}`" in client
    assert "authHeaders" in client


@pytest.mark.parametrize("relative", MOBILE_APPS)
def test_mobile_apps_do_not_embed_ai_service_key(relative: str) -> None:
    app = ROOT / relative
    assert app.is_dir(), f"missing mobile checkout: {relative}"
    offenders: list[str] = []
    for path in (app / "lib").rglob("*.dart"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for marker in MOBILE_FORBIDDEN:
            if marker in text:
                offenders.append(f"{path.relative_to(ROOT)}: contains {marker}")
    assert not offenders, "\n".join(offenders)


@pytest.mark.parametrize("relative", MOBILE_APPS)
def test_mobile_ai_client_uses_user_jwt(relative: str) -> None:
    page = (
        ROOT / relative / "lib" / "features" / "misc" / "ai_insights_page.dart"
    ).read_text(encoding="utf-8")
    assert "tokenProvider:" in page
    assert "'Authorization': 'Bearer $token'" in page


@pytest.mark.parametrize(
    "relative",
    [
        "deploy/vercel/env/quotations-ui.env.example",
        "deploy/vercel/env/love-ai.env.example",
    ],
)
def test_deployment_examples_do_not_inject_ai_key_into_browser(relative: str) -> None:
    text = (ROOT / relative).read_text(encoding="utf-8")
    assert "VITE_AI_API_KEY" not in text
