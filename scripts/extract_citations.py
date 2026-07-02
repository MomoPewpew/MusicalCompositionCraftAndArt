#!/usr/bin/env python3
"""Extract figure citations from Belkin EPUB chapter splits."""

from __future__ import annotations

import json
import re
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPLITS_DIR = Path("/mnt/files/Documents/Torrents/Books/Musical Composition/Splits")
OUTPUT = ROOT / "data" / "citations.json"

CHAPTER_EPUB_RE = re.compile(r"^(\d+) - (\d+)\. .+\.epub$")
FIGURE_CAPTION_RE = re.compile(r"Figure\s+(\d+\.\d+)\.?\s*(.*)", re.IGNORECASE)


class FigureExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.figures: list[dict] = []
        self._in_c220 = False
        self._in_c260 = False
        self._recent_prose: list[str] = []
        self._prose_buffer: list[str] = []
        self._capture: list[str] = []
        self._current: dict | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k: v for k, v in attrs if k and v is not None}
        cls = attr.get("class", "")
        if tag == "div" and "C220" in cls:
            self._in_c220 = True
            self._current = {"prose": list(self._recent_prose[-4:])}
            self._capture = []
        if tag == "p" and "C260" in cls:
            self._in_c260 = True
            self._prose_buffer = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "p" and self._in_c260:
            text = " ".join(part for part in self._prose_buffer if part).strip()
            if text:
                self._recent_prose.append(text)
            self._in_c260 = False
        if tag == "div" and self._in_c220 and self._current is not None:
            body = " ".join(part for part in self._capture if part).strip()
            match = FIGURE_CAPTION_RE.search(body)
            if match:
                self._current["figure"] = match.group(1)
                self._current["caption"] = match.group(2).strip()
                self.figures.append(self._current)
            self._in_c220 = False
            self._current = None

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if not text:
            return
        if self._in_c260:
            self._prose_buffer.append(text)
        if self._in_c220:
            self._capture.append(text)


def chapter_epubs() -> list[tuple[int, Path]]:
    chapters: list[tuple[int, Path]] = []
    for path in sorted(SPLITS_DIR.glob("*.epub")):
        match = CHAPTER_EPUB_RE.match(path.name)
        if match:
            chapters.append((int(match.group(2)), path))
    return chapters


def extract_chapter(chapter_num: int, epub_path: Path) -> list[dict]:
    with zipfile.ZipFile(epub_path) as archive:
        html_names = [name for name in archive.namelist() if name.endswith(".html") and "/xhtml/" in name]
        if not html_names:
            return []
        html = archive.read(html_names[0]).decode("utf-8", errors="replace")

    parser = FigureExtractor()
    parser.feed(html)

    results: list[dict] = []
    for figure in parser.figures:
        results.append(
            {
                "chapter": chapter_num,
                "figure": figure["figure"],
                "caption": figure.get("caption", ""),
                "proseAttribution": figure.get("prose", []),
            }
        )
    return results


def main() -> int:
    if not SPLITS_DIR.is_dir():
        print(f"Splits directory not found: {SPLITS_DIR}", file=sys.stderr)
        return 1

    by_figure: dict[str, dict] = {}
    for chapter_num, epub_path in chapter_epubs():
        for entry in extract_chapter(chapter_num, epub_path):
            key = entry["figure"]
            by_figure[key] = entry

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(by_figure, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(by_figure)} figure citations to {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
