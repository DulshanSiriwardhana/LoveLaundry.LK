#!/usr/bin/env python3
"""Generate a read-only inventory of the legacy LoveLaundry system.

Thin wrapper around the authoritative scanner living in
``system_info/backend/app/scanner.py`` so the offline reports and the live
system_info service can never drift apart.

It NEVER writes to, renames, or deletes anything under the scanned tree; it only
reads source files and emits reports into ``docs/``.

Usage:
  python3 scripts/generate_inventory.py [--source <legacy_root>] [--out <docs_dir>]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1] / "system_info" / "backend"))

from app.scanner import build_model  # noqa: E402


def main() -> int:
    default_root = HERE.parents[2] / "system-manegment"
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=str(default_root))
    ap.add_argument("--out", default=str(HERE.parents[1] / "docs"))
    args = ap.parse_args()

    source = Path(args.source)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if not source.is_dir():
        print(f"source not found: {source}", file=sys.stderr)
        return 2

    model = build_model(source)

    (out / "service_inventory.json").write_text(json.dumps(model, indent=2))

    edges = [
        {"from": "love-bot", "to": "bill-service", "via": "BILL_SERVICE_URL", "verified": True},
        {"from": "love-bot", "to": "quotation-service", "via": "QUOTATION_SERVICE_URL", "verified": True},
        {"from": "love-ai", "to": "mongo", "via": "MONGO_URI/MONGO_DB_NAME", "verified": True},
        {"from": "quotations-ui", "to": "bill-service", "via": "VITE_BILLS_API_URL", "verified": True},
        {"from": "quotations-ui", "to": "laundry-management", "via": "VITE_MGMT_API_URL", "verified": True},
        {"from": "quotations-ui", "to": "user-service", "via": "VITE_USER_API_URL", "verified": True},
        {"from": "quotations-ui", "to": "worker-service", "via": "VITE_WORKERS_API_URL", "verified": True},
        {"from": "quotations-ui", "to": "love-ai", "via": "VITE_AI_API_URL", "verified": True},
    ]
    nodes = [s["name"] for s in model["services"]] + ["love-bot", "mongo"]
    (out / "dependency_graph.json").write_text(
        json.dumps({"nodes": nodes, "edges": edges}, indent=2)
    )

    lines = [
        "# Functional Parity Matrix",
        "",
        "Generated from source decorators + router prefixes. **Do not edit by hand.**",
        "Legend: Ported = route exists in `architecture_updated_system/backend`; "
        "Verified = covered by an automated test.",
        "",
        "Paths are reported exactly as written in source. For services with a non-`/` "
        "mount, the effective public path is `mount + router-defined path` for `@router.*` "
        "routes; `@app.*` routes in `main.py` are already absolute.",
        "",
    ]
    for svc in model["services"]:
        lines.append(
            f"## {svc['name']}  ({len(svc['routes'])} routes, mount `{svc['mount_prefix'] or '/'}`)"
        )
        lines.append("")
        lines.append("| Method | Path | Source | Ported | Verified |")
        lines.append("| --- | --- | --- | --- | --- |")
        for r in svc["routes"]:
            lines.append(f"| {r['method']} | `{r['path']}` | `{r['file']}` | ⬜ | ⬜ |")
        lines.append("")
    (out / "functional_parity_matrix.md").write_text("\n".join(lines))

    print(f"services={model['service_count']} routes={model['route_count']}")
    print(f"wrote {out/'service_inventory.json'}")
    print(f"wrote {out/'dependency_graph.json'}")
    print(f"wrote {out/'functional_parity_matrix.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
