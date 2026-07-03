#!/usr/bin/env python3
"""
Audit and normalize MIDI tempo marks using citation-based inference.

Uses movement names in attributed citations (e.g. Allemande, Menuetto, Prelude),
prose hints from the textbook where available, and defaults for Belkin originals.
Manual overrides live in data/tempo_overrides.json.

Examples:
  python3 scripts/fix_midi_tempos.py --dry-run
  python3 scripts/fix_midi_tempos.py --apply
  python3 scripts/fix_midi_tempos.py --apply --min-delta 15
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.tempo_inference import (  # noqa: E402
    CITATIONS_PATH,
    OVERRIDES_PATH,
    infer_tempo,
    load_json,
)

try:
    from music21 import converter, tempo
except ImportError:
    converter = None  # type: ignore[assignment]
    tempo = None  # type: ignore[assignment]

DOWNLOADS_DIR = ROOT / "downloads" / "Musical Composition Craft And Art"
MANIFEST_PATH = ROOT / "data" / "examples.json"
BACKUP_DIR = ROOT / "downloads" / "Musical Composition Craft And Art.midbak"


def first_bpm(midi_path: Path) -> int | None:
    score = converter.parse(str(midi_path))
    marks = list(score.recurse().getElementsByClass(tempo.MetronomeMark))
    if not marks or marks[0].number is None:
        return None
    return round(float(marks[0].number))


def set_uniform_tempo(midi_path: Path, bpm: int) -> None:
    score = converter.parse(str(midi_path))
    for mark in list(score.recurse().getElementsByClass(tempo.MetronomeMark)):
        mark.activeSite.remove(mark)
    score.insert(0, tempo.MetronomeMark(number=bpm))
    score.write("midi", fp=str(midi_path))


def backup_file(midi_path: Path) -> None:
    rel = midi_path.relative_to(DOWNLOADS_DIR)
    dest = BACKUP_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        shutil.copy2(midi_path, dest)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write corrected MIDI files (default is dry-run)",
    )
    parser.add_argument(
        "--min-delta",
        type=int,
        default=8,
        help="Minimum BPM change required to modify a file (default: 8)",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=MANIFEST_PATH,
        help="Path to data/examples.json",
    )
    parser.add_argument(
        "--downloads",
        type=Path,
        default=DOWNLOADS_DIR,
        help="Directory containing organized MIDI/PNG assets",
    )
    return parser.parse_args()


def main() -> int:
    if converter is None:
        print("music21 is required (.venv/bin/pip install -r requirements.txt)", file=sys.stderr)
        return 1

    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    citations = load_json(CITATIONS_PATH, {})
    overrides = load_json(OVERRIDES_PATH, {})

    planned: list[dict] = []
    skipped = 0

    for example in manifest["examples"]:
        midi_rel = example.get("assets", {}).get("midi")
        if not midi_rel:
            continue
        midi_path = args.downloads / midi_rel
        if not midi_path.is_file():
            continue

        current = first_bpm(midi_path)
        recommended, reason = infer_tempo(
            example,
            citations=citations,
            overrides=overrides,
            current_bpm=current,
        )
        if recommended is None or current is None:
            skipped += 1
            continue
        delta = abs(recommended - current)
        if delta < args.min_delta:
            skipped += 1
            continue

        planned.append(
            {
                "id": example["id"],
                "path": midi_path,
                "current": current,
                "recommended": recommended,
                "delta": delta,
                "reason": reason,
                "citation": example.get("citation", "")[:70],
            }
        )

    planned.sort(key=lambda row: (-row["delta"], row["id"]))

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"{mode}: {len(planned)} MIDI file(s) to update, {skipped} unchanged\n")

    for row in planned:
        print(
            f"{row['id']:14} {row['current']:>3} -> {row['recommended']:>3}  "
            f"({row['reason']})  {row['citation']}"
        )

    if not args.apply:
        if planned:
            print("\nRe-run with --apply to write changes (backs up to .midbak/ first).")
        return 0

    for row in planned:
        backup_file(row["path"])
        set_uniform_tempo(row["path"], row["recommended"])
        print(f"Updated {row['id']} -> {row['recommended']} BPM")

    if planned:
        print(f"\nBackups: {BACKUP_DIR}")
        print("Rebuild web assets: cd web && npm run build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
