#!/usr/bin/env python3
"""
Reorganize downloaded examples into Example/Section subfolders.

Example layout:
  Chapter 1/
    Example 1/
      Section 1/
        Ex1-1-(1).mid
        Ex1-1-(1).png
        Ex1-1-(1).musicxml
    Example 2/
      Ex1-2.mid
      Ex1-2.png
      Ex1-2.musicxml
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from example_paths import example_asset_names, example_dest_dir

DEFAULT_BOOK_DIR = (
    Path(__file__).resolve().parent / "downloads" / "Musical Composition Craft And Art"
)
DEFAULT_MANIFEST = Path(__file__).resolve().parent / "downloads" / "Musical Composition Craft And Art.json"


def load_manifest(manifest_path: Path) -> dict:
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def find_source_file(chapter_dir: Path, filename: str, dest_dir: Path) -> Path | None:
    direct = chapter_dir / filename
    if direct.is_file():
        return direct

    nested = dest_dir / filename
    if nested.is_file():
        return nested

    matches = [path for path in chapter_dir.rglob(filename) if path.is_file()]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise FileExistsError(f"Multiple files named {filename} under {chapter_dir}")
    return None


def organize_book(book: dict, book_dir: Path, dry_run: bool) -> tuple[int, int, int]:
    moved = skipped = missing = 0

    for chapter in book["chapters"]:
        chapter_dir = book_dir / chapter["name"]
        if not chapter_dir.is_dir():
            print(f"Skipping missing chapter folder: {chapter_dir}", file=sys.stderr)
            continue

        for example in chapter["examples"]:
            example_name = example["name"]
            dest_dir = example_dest_dir(chapter_dir, example_name)

            for filename in example_asset_names(example_name):
                source = find_source_file(chapter_dir, filename, dest_dir)
                if source is None:
                    missing += 1
                    continue

                target = dest_dir / filename
                if source.resolve() == target.resolve():
                    skipped += 1
                    continue

                if dry_run:
                    print(f"  {source.relative_to(book_dir)}")
                    print(f"    -> {target.relative_to(book_dir)}")
                    moved += 1
                    continue

                dest_dir.mkdir(parents=True, exist_ok=True)
                shutil.move(str(source), str(target))
                moved += 1

    return moved, skipped, missing


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Organize examples into Example/Section subfolders."
    )
    parser.add_argument(
        "-d",
        "--book-dir",
        type=Path,
        default=DEFAULT_BOOK_DIR,
        help=f"Book download directory (default: {DEFAULT_BOOK_DIR})",
    )
    parser.add_argument(
        "-m",
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help=f"Book manifest JSON (default: {DEFAULT_MANIFEST})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show moves without changing files",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    book_dir = args.book_dir.resolve()
    manifest_path = args.manifest.resolve()

    if not book_dir.is_dir():
        print(f"Book directory not found: {book_dir}", file=sys.stderr)
        return 1
    if not manifest_path.is_file():
        print(f"Manifest not found: {manifest_path}", file=sys.stderr)
        return 1

    book = load_manifest(manifest_path)
    print(f"Book: {book['name']}")
    print(f"Directory: {book_dir}")
    if args.dry_run:
        print("Dry run:")

    moved, skipped, missing = organize_book(book, book_dir, args.dry_run)
    print()
    print(f"Done. {moved} moved, {skipped} already in place, {missing} missing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
