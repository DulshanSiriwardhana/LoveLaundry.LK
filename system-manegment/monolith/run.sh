#!/usr/bin/env bash
# Run the LoveLaundry monolith (single process, all subsystems).
# Mirrors microservice boot requirements: JWT_SECRET + MASTER_KEY are mandatory.
set -euo pipefail
: "${JWT_SECRET:?Set JWT_SECRET (must match all subsystems)}"
: "${MASTER_KEY:?Set MASTER_KEY (must match all subsystems)}"
PORT="${PORT:-8000}"
PYTHONPATH=src exec python3 -m uvicorn monolith.main:app --host 0.0.0.0 --port "$PORT"
