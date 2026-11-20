#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .venv/bin/python ]]; then "${ECONODO_PYTHON:-python3}" -m venv .venv; fi
.venv/bin/python -m pip install --disable-pip-version-check -r requirements.txt
export ECONODO_DEMO=1
export ECONODO_DATA_DIR="$PWD/demo_data"
.venv/bin/python tools/cargar_demo.py
exec .venv/bin/python run_server.py
