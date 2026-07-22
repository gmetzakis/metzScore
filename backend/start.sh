#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
export PYTHONUNBUFFERED=1
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
exec uvicorn main:app --host 0.0.0.0 --port 8001
