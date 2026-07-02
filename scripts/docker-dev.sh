#!/usr/bin/env bash
set -euo pipefail

cd /app

if [[ ! -f data/examples.json ]]; then
  echo "Building examples manifest..."
  if [[ -f data/citations.json ]]; then
    python3 scripts/build_examples_manifest.py
  else
    python3 scripts/extract_citations.py || true
    python3 scripts/build_examples_manifest.py
  fi
fi

cd web
exec npm run dev
