#!/usr/bin/env python3
"""
Download clipped YouTube audio archives for curated example recordings.

Reads data/example-youtube.json and writes MP3 clips to youtube-archives/{exampleId}.mp3
using yt-dlp. Run locally; commit the resulting files. Do not run in CI.

Requires: yt-dlp and ffmpeg on PATH.

Examples:
  python3 scripts/download_youtube_archives.py
  python3 scripts/download_youtube_archives.py --force
  python3 scripts/download_youtube_archives.py --example Ex3-4
  python3 scripts/download_youtube_archives.py --chapters 1-4
  python3 scripts/download_youtube_archives.py --chapters 1,3,5-7 --force
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "data" / "example-youtube.json"
EXAMPLES_PATH = ROOT / "data" / "examples.json"
ARCHIVES_DIR = ROOT / "youtube-archives"
AUDIO_EXTS = (".mp3", ".m4a", ".ogg", ".wav", ".webm", ".opus")


def load_manifest() -> dict:
    if not MANIFEST_PATH.is_file():
        raise FileNotFoundError(f"Missing manifest: {MANIFEST_PATH}")
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected object in {MANIFEST_PATH}")
    return data


def load_example_chapters() -> dict[str, int]:
    if not EXAMPLES_PATH.is_file():
        raise FileNotFoundError(
            f"Missing {EXAMPLES_PATH} (needed for --chapters). "
            "Run: python3 scripts/build_examples_manifest.py"
        )
    data = json.loads(EXAMPLES_PATH.read_text(encoding="utf-8"))
    examples = data.get("examples", data if isinstance(data, list) else [])
    chapters: dict[str, int] = {}
    for example in examples:
        example_id = example.get("id")
        chapter_number = example.get("chapterNumber")
        if example_id and isinstance(chapter_number, int):
            chapters[example_id] = chapter_number
    return chapters


def parse_chapter_spec(spec: str) -> set[int]:
    """Parse '1-4', '1,3,5-7', or '2' into a set of chapter numbers."""
    chapters: set[int] = set()
    for part in re.split(r"\s*,\s*", spec.strip()):
        if not part:
            continue
        if "-" in part:
            start_s, end_s = part.split("-", 1)
            start, end = int(start_s), int(end_s)
            if end < start:
                raise ValueError(f"Invalid chapter range {part!r} (end < start)")
            chapters.update(range(start, end + 1))
        else:
            chapters.add(int(part))
    if not chapters:
        raise ValueError(f"No chapters parsed from {spec!r}")
    return chapters


def existing_archive(example_id: str) -> Path | None:
    for ext in AUDIO_EXTS:
        candidate = ARCHIVES_DIR / f"{example_id}{ext}"
        if candidate.is_file():
            return candidate
    return None


def require_tools() -> str:
    yt_dlp = shutil.which("yt-dlp")
    if not yt_dlp:
        raise FileNotFoundError("yt-dlp not found on PATH. Install: https://github.com/yt-dlp/yt-dlp")
    if not shutil.which("ffmpeg"):
        raise FileNotFoundError("ffmpeg not found on PATH (required for audio extract/clip).")
    return yt_dlp


def probe_duration_seconds(yt_dlp: str, youtube: str) -> int:
    result = subprocess.run(
        [
            yt_dlp,
            "--no-playlist",
            "--no-update",
            "--print",
            "%(duration)s",
            "--",
            youtube,
        ],
        check=True,
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    line = result.stdout.strip().splitlines()[-1].strip()
    duration = float(line)
    if duration <= 0:
        raise ValueError(f"Could not read duration for {youtube}: {line!r}")
    return int(duration) if duration == int(duration) else int(duration) + 1


def download_clip(
    yt_dlp: str,
    example_id: str,
    youtube: str,
    start_seconds: int,
    end_seconds: int | None,
) -> Path:
    ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)
    output_template = str(ARCHIVES_DIR / f"{example_id}.%(ext)s")

    resolved_end = end_seconds
    if resolved_end is None:
        if start_seconds > 0:
            resolved_end = probe_duration_seconds(yt_dlp, youtube)
        range_label = f"{start_seconds}s–end"
    else:
        range_label = f"{start_seconds}s–{resolved_end}s"

    cmd = [
        yt_dlp,
        "--no-playlist",
        "--no-update",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        output_template,
    ]
    if resolved_end is not None:
        cmd.extend(
            [
                "--force-keyframes-at-cuts",
                "--download-sections",
                f"*{start_seconds}-{resolved_end}",
            ]
        )
    cmd.extend(["--", youtube])

    print(f"[{example_id}] {youtube}  ({range_label})")
    subprocess.run(cmd, check=True, cwd=ROOT)

    archive = existing_archive(example_id)
    if archive is None:
        raise FileNotFoundError(f"yt-dlp finished but no archive found for {example_id}")
    return archive


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even when an archive file already exists",
    )
    parser.add_argument(
        "--example",
        action="append",
        dest="examples",
        metavar="ID",
        help="Only process this example id (repeatable)",
    )
    parser.add_argument(
        "--chapters",
        metavar="SPEC",
        help="Only process examples in these chapters (e.g. 1-4 or 1,3,5-7)",
    )
    args = parser.parse_args()

    try:
        yt_dlp = require_tools()
        manifest = load_manifest()
        chapter_filter: set[int] | None = None
        example_chapters: dict[str, int] = {}
        if args.chapters:
            chapter_filter = parse_chapter_spec(args.chapters)
            example_chapters = load_example_chapters()
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    selected = set(args.examples) if args.examples else None
    downloaded = 0
    skipped = 0
    failed = 0

    if chapter_filter is not None:
        print(f"Chapter filter: {', '.join(str(c) for c in sorted(chapter_filter))}")

    for example_id, entry in sorted(manifest.items()):
        if selected is not None and example_id not in selected:
            continue
        if chapter_filter is not None:
            chapter_number = example_chapters.get(example_id)
            if chapter_number not in chapter_filter:
                continue
        if not isinstance(entry, dict):
            print(f"[{example_id}] skip: invalid entry")
            skipped += 1
            continue

        youtube = (entry.get("youtube") or "").strip()
        if not youtube:
            print(f"[{example_id}] skip: missing youtube URL")
            skipped += 1
            continue

        start_seconds = int(entry.get("startSeconds") or 0)
        end_raw = entry.get("endSeconds")
        end_seconds = int(end_raw) if end_raw is not None else None
        if end_seconds is not None and end_seconds <= start_seconds:
            print(
                f"[{example_id}] skip: endSeconds ({end_seconds}) must be > startSeconds ({start_seconds})"
            )
            skipped += 1
            continue

        existing = existing_archive(example_id)
        if existing and not args.force:
            print(f"[{example_id}] exists: {existing.relative_to(ROOT)} (use --force to redo)")
            skipped += 1
            continue

        if existing and args.force:
            existing.unlink()

        try:
            archive = download_clip(yt_dlp, example_id, youtube, start_seconds, end_seconds)
        except (subprocess.CalledProcessError, FileNotFoundError, ValueError) as exc:
            print(f"[{example_id}] failed: {exc}", file=sys.stderr)
            failed += 1
            continue

        print(f"[{example_id}] wrote {archive.relative_to(ROOT)}")
        downloaded += 1

    if selected is not None:
        missing = sorted(selected - set(manifest))
        for example_id in missing:
            print(f"[{example_id}] skip: not in {MANIFEST_PATH.relative_to(ROOT)}")
            skipped += 1

    print(f"Done: {downloaded} downloaded, {skipped} skipped, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
