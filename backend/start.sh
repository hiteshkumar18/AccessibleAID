#!/usr/bin/env bash
# Start the EnableCare Python AI backend.
# Run from anywhere:  bash backend/start.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create venv if missing
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment …"
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip -q
  echo "Installing dependencies (first-time setup, ~5 min) …"
  .venv/bin/pip install -r requirements.txt -q
fi

echo "Starting EnableCare AI backend on http://localhost:8000 …"
.venv/bin/python main.py
