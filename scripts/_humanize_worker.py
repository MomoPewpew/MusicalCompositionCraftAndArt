#!/usr/bin/env python3
"""Worker invoked by humanize_midi_assets.py inside midihum's virtualenv."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--midihum-dir", type=Path, required=True)
    parser.add_argument("--downloads", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sources-json", required=True)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    midihum_dir = args.midihum_dir.resolve()
    downloads_dir = args.downloads.resolve()
    humanized_dir = args.output.resolve()
    sources = [Path(p) for p in json.loads(args.sources_json)]

    os.chdir(midihum_dir)
    sys.path.insert(0, str(midihum_dir))
    from midihum_model import MidihumModel  # noqa: E402

    model = MidihumModel()
    written = skipped = failed = 0
    started = time.time()

    for source in sources:
        if not source.is_file():
            failed += 1
            print(f"missing: {source}", flush=True)
            continue

        dest = humanized_dir / source.relative_to(downloads_dir)
        if (
            not args.force
            and dest.is_file()
            and source.stat().st_mtime <= dest.stat().st_mtime
        ):
            skipped += 1
            continue

        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            model.humanize(source, dest)
            written += 1
        except Exception as exc:
            failed += 1
            print(f"failed: {source.name}: {exc}", flush=True)

    elapsed = time.time() - started
    print(
        f"written={written} skipped={skipped} failed={failed} elapsed={elapsed:.1f}s",
        flush=True,
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
