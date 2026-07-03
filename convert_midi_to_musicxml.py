#!/usr/bin/env python3
"""
Convert downloaded MIDI files to MusicXML using music21.

Legacy fallback — MIDI→XML loses layout and often mis-voices parts. Prefer OMR from
the textbook PNGs instead:

  python3 scripts/convert_png_to_musicxml.py

Original .mid files are left untouched. Each MusicXML file is written alongside
its source MIDI with the same stem and a .musicxml extension.
"""

from __future__ import annotations

import argparse
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

try:
    from music21 import converter
except ImportError:
    converter = None  # type: ignore[assignment]

DEFAULT_INPUT = Path(__file__).resolve().parent / "downloads" / "Musical Composition Craft And Art"


@dataclass(frozen=True)
class ConvertTask:
    midi: Path
    musicxml: Path


def discover_midis(input_dir: Path) -> list[ConvertTask]:
    tasks: list[ConvertTask] = []
    for midi in sorted(input_dir.rglob("*.mid")):
        tasks.append(ConvertTask(midi=midi, musicxml=midi.with_suffix(".musicxml")))
    return tasks


def convert_one(midi_path: str, force: bool) -> tuple[str, bool, str]:
    midi = Path(midi_path)
    musicxml = midi.with_suffix(".musicxml")

    if musicxml.exists() and not force:
        return midi.name, True, "skipped"

    try:
        score = converter.parse(str(midi))
        score.write("musicxml", fp=str(musicxml))
    except Exception as exc:  # music21 raises varied exception types
        if musicxml.exists():
            musicxml.unlink()
        return midi.name, False, str(exc)

    return midi.name, True, "converted"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert MIDI files to MusicXML (keeps original MIDI files)."
    )
    parser.add_argument(
        "-i",
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Directory to scan for .mid files (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "-j",
        "--jobs",
        type=int,
        default=4,
        help="Parallel conversion workers (default: 4)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-convert even when .musicxml already exists",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List conversions without writing files",
    )
    return parser.parse_args()


def main() -> int:
    if converter is None:
        print(
            "music21 is required. Install dependencies first:\n"
            "  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt",
            file=sys.stderr,
        )
        return 1

    args = parse_args()
    input_dir = args.input.resolve()

    if not input_dir.is_dir():
        print(f"Input directory not found: {input_dir}", file=sys.stderr)
        return 1

    tasks = discover_midis(input_dir)
    if not tasks:
        print(f"No .mid files found under {input_dir}", file=sys.stderr)
        return 1

    print(f"Input: {input_dir}")
    print(f"MIDI files: {len(tasks)}")

    if args.dry_run:
        for task in tasks:
            print(f"  {task.midi}")
            print(f"    -> {task.musicxml}")
        return 0

    converted = skipped = failed = 0
    jobs = max(1, args.jobs)
    midi_paths = [str(task.midi) for task in tasks]

    with ProcessPoolExecutor(max_workers=jobs) as pool:
        futures = {
            pool.submit(convert_one, midi_path, args.force): midi_path for midi_path in midi_paths
        }
        for index, future in enumerate(as_completed(futures), start=1):
            name, ok, status = future.result()
            if ok and status == "skipped":
                skipped += 1
            elif ok:
                converted += 1
            else:
                failed += 1
                print(f"FAIL [{index}/{len(tasks)}] {name}: {status}", file=sys.stderr)

            if index % 25 == 0 or index == len(tasks):
                print(
                    f"Progress: {index}/{len(tasks)} "
                    f"({converted} converted, {skipped} skipped, {failed} failed)"
                )

    print()
    print(f"Done. {converted} converted, {skipped} skipped, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
