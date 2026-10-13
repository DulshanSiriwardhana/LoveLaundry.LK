# Documentation Index

| Document | Status | Purpose |
| --- | --- | --- |
| `initial_system_audit.md` | ✅ complete | Stage 1 read-only analysis of the original system (verified vs inferred). |
| `architecture_decisions.md` | ✅ complete | ADR-000..009 for the recreation. |
| `service_inventory.json` | ✅ generated | Machine-readable inventory (9 services, 420 routes). |
| `dependency_graph.json` | ✅ generated | Service dependency edges. |
| `functional_parity_matrix.md` | ✅ generated | Every legacy route with Ported/Verified tick boxes. |
| `current_checkpoint.md` | ✅ living | Stage status, real test totals, next steps. |
| `testing_strategy.md` | ✅ complete | Test layers, hermeticity, cross-language contracts. |
| `security_notes.md` | ✅ complete | Isolation/bounding/redaction guarantees; auth/crypto. |
| `migration_plan.md` | ✅ complete | Parallel-run → shadow → module cutover → decommission. |

## Regenerating the inventory

```bash
.venv/bin/python scripts/generate_inventory.py
```

Writes `service_inventory.json`, `dependency_graph.json` and
`functional_parity_matrix.md` by scanning the legacy tree read-only.

## Still to write (backlog)

- `deployment_guide.md` (beyond `deployment/README.md`)
- `api_reference.md` (generated from OpenAPI once modules are ported)
- `data_model.md` (once entity/collection names are confirmed)
- `operations_runbook.md`
