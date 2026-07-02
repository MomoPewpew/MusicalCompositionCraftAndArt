#!/usr/bin/env python3
"""
Download MIDI files and sheet-music images from the Music Ed textbook site.

Uses the public book manifest JSON (same source as textbook.realmusictheory.com)
and saves files under output/<book>/<chapter>/.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from example_paths import example_dest_dir

S3_BASE = "https://music-ed.s3.us-east-2.amazonaws.com"
DEFAULT_BOOK = "Musical Composition Craft And Art"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "downloads"


@dataclass(frozen=True)
class DownloadTask:
    url: str
    dest: Path
    label: str


def manifest_url(book_name: str) -> str:
    return f"{S3_BASE}/{urllib.parse.quote(book_name)}.json"


def asset_url(base_url: str, chapter_name: str, filename: str) -> str:
    base = base_url if base_url.endswith("/") else f"{base_url}/"
    # Encode chapter path segments; filenames from the manifest are already S3-safe.
    return f"{base}{urllib.parse.quote(chapter_name)}/{filename}"


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def download_file(task: DownloadTask, force: bool) -> tuple[str, bool, str]:
    if task.dest.exists() and not force:
        return task.label, True, "skipped"

    task.dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(task.url)
    try:
        with urllib.request.urlopen(request, timeout=120) as response, task.dest.open("wb") as handle:
            handle.write(response.read())
    except urllib.error.HTTPError as exc:
        if task.dest.exists():
            task.dest.unlink()
        return task.label, False, f"HTTP {exc.code}"
    except OSError as exc:
        if task.dest.exists():
            task.dest.unlink()
        return task.label, False, str(exc)

    return task.label, True, "downloaded"


def build_tasks(book: dict, output_dir: Path) -> list[DownloadTask]:
    book_name = book["name"]
    base_url = book["baseUrl"]
    book_dir = output_dir / book_name
    tasks: list[DownloadTask] = []

    for chapter in book["chapters"]:
        chapter_name = chapter["name"]
        chapter_dir = book_dir / chapter_name

        for example in chapter["examples"]:
            example_name = example["name"]
            dest_dir = example_dest_dir(chapter_dir, example_name)
            for key, ext in (("midi", ".mid"), ("image", ".png")):
                filename = example[key]
                dest = dest_dir / filename
                url = asset_url(base_url, chapter_name, filename)
                tasks.append(
                    DownloadTask(
                        url=url,
                        dest=dest,
                        label=f"{chapter_name} / {example_name}{ext}",
                    )
                )

    return tasks


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download MIDI and sheet-music images for a Music Ed textbook."
    )
    parser.add_argument(
        "--book",
        default=DEFAULT_BOOK,
        help=f'Book title as used on the site (default: "{DEFAULT_BOOK}")',
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output directory (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "-j",
        "--jobs",
        type=int,
        default=8,
        help="Parallel downloads (default: 8)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download files even if they already exist",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files that would be downloaded without fetching them",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_dir = args.output.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Fetching manifest for: {args.book}")
    try:
        book = fetch_json(manifest_url(args.book))
    except urllib.error.HTTPError as exc:
        print(f"Failed to load manifest: HTTP {exc.code}", file=sys.stderr)
        return 1
    except (urllib.error.URLError, json.JSONDecodeError, KeyError) as exc:
        print(f"Failed to load manifest: {exc}", file=sys.stderr)
        return 1

    manifest_path = output_dir / f"{book['name']}.json"
    manifest_path.write_text(json.dumps(book, indent=2) + "\n", encoding="utf-8")
    print(f"Saved manifest: {manifest_path}")

    tasks = build_tasks(book, output_dir)
    chapter_count = len(book["chapters"])
    example_count = sum(len(ch["examples"]) for ch in book["chapters"])
    print(f"Book: {book['name']}")
    print(f"Chapters: {chapter_count}, examples: {example_count}, files: {len(tasks)}")
    print(f"Output: {output_dir / book['name']}")

    if args.dry_run:
        for task in tasks:
            print(f"  {task.label}")
            print(f"    -> {task.dest}")
            print(f"    <- {task.url}")
        return 0

    downloaded = skipped = failed = 0
    jobs = max(1, args.jobs)

    with ThreadPoolExecutor(max_workers=jobs) as pool:
        futures = {pool.submit(download_file, task, args.force): task for task in tasks}
        for index, future in enumerate(as_completed(futures), start=1):
            label, ok, status = future.result()
            if ok and status == "skipped":
                skipped += 1
            elif ok:
                downloaded += 1
            else:
                failed += 1
                print(f"FAIL [{index}/{len(tasks)}] {label}: {status}", file=sys.stderr)

            if index % 25 == 0 or index == len(tasks):
                print(f"Progress: {index}/{len(tasks)} ({downloaded} new, {skipped} skipped, {failed} failed)")

    print()
    print(f"Done. {downloaded} downloaded, {skipped} skipped, {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
