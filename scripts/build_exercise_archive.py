#!/usr/bin/env python3
"""Package handmade exercise MusicXML files for website download."""

from __future__ import annotations

import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXERCISE_DIR = ROOT / "exercise_assets"
OUTPUT_MANIFEST = ROOT / "data" / "exercise-assets.json"
OUTPUT_DIR = ROOT / "web" / "public" / "assets" / "exercises"

EXE_PATTERN = re.compile(r"^Exe(\d+)-(\d+)(?:-\((\d+)\))?\.musicxml$", re.IGNORECASE)


def parse_exercise_filename(name: str) -> tuple[int, int, int | None] | None:
    match = EXE_PATTERN.match(name)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2)), (
        int(match.group(3)) if match.group(3) else None
    )


def build() -> dict:
    empty = {"fileCount": 0, "chapters": {}}
    if not EXERCISE_DIR.is_dir():
        OUTPUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_MANIFEST.write_text(json.dumps(empty, indent=2) + "\n", encoding="utf-8")
        return empty

    files = sorted(path for path in EXERCISE_DIR.glob("*.musicxml") if path.is_file())
    by_chapter: dict[str, list[Path]] = defaultdict(list)

    for path in files:
        parsed = parse_exercise_filename(path.name)
        if parsed is None:
            print(f"WARN skipping unrecognized exercise file: {path.name}")
            continue
        chapter_num, _exercise_num, _section = parsed
        by_chapter[str(chapter_num)].append(path)

    if not by_chapter:
        OUTPUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_MANIFEST.write_text(json.dumps(empty, indent=2) + "\n", encoding="utf-8")
        return empty

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUTPUT_DIR.glob("chapter-*.zip"):
        stale.unlink()

    chapters: dict[str, dict] = {}
    total_files = 0

    for chapter, chapter_files in sorted(by_chapter.items(), key=lambda item: int(item[0])):
        archive_name = f"chapter-{chapter}.zip"
        archive_path = OUTPUT_DIR / archive_name
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(chapter_files, key=lambda item: item.name):
                archive.write(path, arcname=path.name)

        names = sorted(path.name for path in chapter_files)
        chapters[chapter] = {
            "fileCount": len(names),
            "files": names,
            "archive": f"assets/exercises/{archive_name}",
        }
        total_files += len(names)
        print(f"Wrote {archive_path} ({len(names)} MusicXML files)")

    payload = {"fileCount": total_files, "chapters": chapters}
    OUTPUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_MANIFEST.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_MANIFEST} ({total_files} files across {len(chapters)} chapter(s))")
    return payload


def main() -> int:
    build()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
