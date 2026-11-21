"""QR scan throughput and idempotency evidence at batch scale."""

import asyncio
import time

from fastapi.testclient import TestClient

from app.runtime import get_runtime


def test_batch_scan_ingestion_throughput_and_idempotency(client: TestClient) -> None:
    count = 500
    for index in range(count):
        response = client.post(
            "/linen/items/register",
            json={
                "organization_id": "org-throughput",
                "linen_id": f"linen-{index}",
                "code": f"QR-THROUGHPUT-{index}",
            },
        )
        assert response.status_code == 200

    batch = {
        "scans": [
            {
                "organization_id": "org-throughput",
                "scan_id": f"scan-{index}",
                "code": f"QR-THROUGHPUT-{index}",
                "action": "assign",
                "scanner_id": "scanner-bench",
                "batch_id": "bench-1",
            }
            for index in range(count)
        ]
    }

    started = time.perf_counter()
    first = client.post("/linen/items/scans/batch", json=batch)
    elapsed = time.perf_counter() - started
    assert first.status_code == 200
    assert first.json()["count"] == count
    assert first.json()["outcomes"] == {"accepted": count}

    # Generous ceiling: catches pathological regressions without being flaky on
    # slower CI runners. The achieved rate is printed as explicit evidence.
    assert elapsed < 30
    rate = count / elapsed
    assert rate > 15
    print(f"\nBatch QR ingestion: {count} scans in {elapsed:.3f}s ({rate:.0f} scans/s)")

    started = time.perf_counter()
    duplicate = client.post("/linen/items/scans/batch", json=batch)
    duplicate_elapsed = time.perf_counter() - started
    assert duplicate.json()["outcomes"] == {"duplicate": count}

    scans = asyncio.run(
        get_runtime().linen_repository.list_scans(
            organization_id="org-throughput", limit=2000
        )
    )
    assert len(scans) == count
    print(
        f"Idempotent replay: {count} scans in {duplicate_elapsed:.3f}s "
        f"({count / duplicate_elapsed:.0f} scans/s)"
    )
