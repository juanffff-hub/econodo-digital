#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .venv/bin/python ]]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install --disable-pip-version-check -r requirements.txt
unset ECONODO_DEMO
export ECONODO_DATA_DIR="$PWD/data"
exec .venv/bin/python run_server.py
