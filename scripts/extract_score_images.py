#!/usr/bin/env python3
"""
Extract high-resolution score PNGs from the textbook EPUB.

Maps each example to its textbook figure via data/citations.json / examples.json,
then writes PNGs into downloads/ (optionally backing up the previous e7mac images).

For figures split into multiple website sections (e.g. Figure 1.1 → Ex1-1-(1..4)),
the composite EPUB image is cropped into horizontal bands.

Examples:
  python3 scripts/extract_score_images.py --dry-run
  python3 scripts/extract_score_images.py
  EPUB_PATH=/path/to/book.epub python3 scripts/extract_score_images.py --no-backup
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import shutil
import sys
import zipfile
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
DEFAULT_EPUB = Path(
    "/mnt/files/Documents/Torrents/Books/Musical Composition/"
    "Belkin, Alan - Musical composition_ craft and art (2018, Yale University Press) - libgen.li.epub"
)
DOWNLOADS_DIR = ROOT / "downloads" / "Musical Composition Craft And Art"
MANIFEST_PATH = ROOT / "data" / "examples.json"
BACKUP_SUFFIX = ".e7mac.png"

FIGURE_CAPTION_RE = re.compile(r"Figure\s+([\d.]+)", re.IGNORECASE)


class FigureExtractor(HTMLParser):
    """Extract figure number, image src, and caption from C220 figure blocks."""

    def __init__(self) -> None:
        super().__init__()
        self.figures: list[tuple[str, str, str]] = []
        self._in_c220 = False
        self._img_src: str | None = None
        self._caption_parts: list[str] = []
        self._in_caption = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k: v for k, v in attrs if k and v is not None}
        cls = attr.get("class", "")
        if tag == "div" and "C220" in cls:
            self._in_c220 = True
            self._img_src = None
            self._caption_parts = []
        if self._in_c220 and tag == "img":
            self._img_src = attr.get("src", "")
        if self._in_c220 and tag == "p" and "C234" in cls:
            self._in_caption = True
            self._caption_parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "p" and self._in_caption:
            self._in_caption = False
        if tag == "div" and self._in_c220:
            caption = " ".join(part for part in self._caption_parts if part).strip()
            match = FIGURE_CAPTION_RE.search(caption)
            if match and self._img_src:
                ref = match.group(1).rstrip(".")
                self.figures.append((ref, self._img_src, caption))
            self._in_c220 = False

    def handle_data(self, data: str) -> None:
        if self._in_caption:
            text = data.strip()
            if text:
                self._caption_parts.append(text)


def load_epub_figures(epub_path: Path) -> dict[str, tuple[str, str]]:
    """Return figure ref (e.g. '7.1') -> (archive path, caption)."""
    figures: dict[str, tuple[str, str]] = {}
    with zipfile.ZipFile(epub_path) as archive:
        for name in archive.namelist():
            if not name.endswith(".html"):
                continue
            parser = FigureExtractor()
            parser.feed(archive.read(name).decode("utf-8", errors="replace"))
            for ref, src, caption in parser.figures:
                archive_path = src.replace("../", "OEBPS/")
                if not archive_path.startswith("OEBPS/"):
                    archive_path = f"OEBPS/{src.lstrip('/')}"
                if ref in figures and figures[ref][0] != archive_path:
                    print(f"WARN duplicate figure {ref}: {figures[ref][0]} vs {archive_path}", file=sys.stderr)
                figures[ref] = (archive_path, caption)
    return figures


def section_index(example_id: str) -> int | None:
    from example_paths import parse_example_name

    parsed = parse_example_name(example_id)
    return parsed.section_num


def examples_by_figure(manifest: dict) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for example in manifest.get("examples", []):
        ref = example.get("figureRef")
        if ref:
            grouped[ref].append(example)
    for ref in grouped:
        grouped[ref].sort(
            key=lambda row: (
                section_index(row["id"]) or 0,
                row["id"],
            )
        )
    return grouped


def read_epub_image(archive: zipfile.ZipFile, archive_path: str):
    from PIL import Image

    data = archive.read(archive_path)
    return Image.open(io.BytesIO(data))


def crop_section(image, index: int, count: int):
    width, height = image.size
    top = round(index * height / count)
    bottom = round((index + 1) * height / count)
    return image.crop((0, top, width, bottom))


def backup_existing(path: Path, backup: bool) -> None:
    if not backup or not path.is_file():
        return
    dest = path.with_name(path.name + BACKUP_SUFFIX)
    if not dest.is_file():
        shutil.copy2(path, dest)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epub", type=Path, help="Path to textbook EPUB")
    parser.add_argument("--downloads", type=Path, default=DOWNLOADS_DIR)
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help=f"Do not keep previous PNGs as *{BACKUP_SUFFIX}",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite even when PNG is newer")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    epub_path = (args.epub or Path(os.environ.get("EPUB_PATH", DEFAULT_EPUB))).resolve()
    downloads_dir = args.downloads.resolve()

    if not epub_path.is_file():
        print(f"EPUB not found: {epub_path}", file=sys.stderr)
        return 1
    if not args.manifest.is_file():
        print(f"Manifest not found: {args.manifest}", file=sys.stderr)
        return 1

    try:
        from PIL import Image
    except ImportError:
        print("Pillow is required: pip install Pillow", file=sys.stderr)
        return 1

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    epub_figures = load_epub_figures(epub_path)
    grouped = examples_by_figure(manifest)

    print(f"EPUB: {epub_path}")
    print(f"Figures in EPUB: {len(epub_figures)}")
    print(f"Figures used by examples: {len(grouped)}")

    written = skipped = missing = failed = 0

    with zipfile.ZipFile(epub_path) as archive:
        for figure_ref, examples in sorted(
            grouped.items(),
            key=lambda item: [int(part) for part in item[0].split(".")],
        ):
            if figure_ref not in epub_figures:
                missing += len(examples)
                print(f"MISSING figure {figure_ref} ({len(examples)} examples)", file=sys.stderr)
                continue

            archive_path, caption = epub_figures[figure_ref]
            try:
                composite = read_epub_image(archive, archive_path)
            except Exception as exc:
                failed += len(examples)
                print(f"FAIL {figure_ref}: cannot read {archive_path}: {exc}", file=sys.stderr)
                continue

            count = len(examples)
            for index, example in enumerate(examples):
                image_rel = example.get("assets", {}).get("image")
                if not image_rel:
                    continue
                dest = downloads_dir / image_rel
                if (
                    not args.dry_run
                    and not args.force
                    and dest.is_file()
                    and dest.stat().st_mtime >= epub_path.stat().st_mtime
                ):
                    skipped += 1
                    continue

                image = composite if count == 1 else crop_section(composite, index, count)
                if args.dry_run:
                    print(
                        f"  {example['id']:14} <- {archive_path}"
                        f"{' [crop ' + str(index + 1) + '/' + str(count) + ']' if count > 1 else ''}"
                        f" -> {dest.relative_to(downloads_dir)} ({image.size[0]}x{image.size[1]})"
                    )
                    written += 1
                    continue

                dest.parent.mkdir(parents=True, exist_ok=True)
                backup_existing(dest, backup=not args.no_backup)
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGBA")
                image.save(dest, format="PNG")
                written += 1
                print(
                    f"OK {example['id']:14} {image.size[0]}x{image.size[1]}  "
                    f"{caption[:55]}"
                )

    print()
    print(f"Done. {written} written, {skipped} skipped, {missing} missing figure, {failed} failed.")
    if not args.no_backup:
        print(f"Previous PNGs backed up as *{BACKUP_SUFFIX} when replaced.")
    return 1 if missing or failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
