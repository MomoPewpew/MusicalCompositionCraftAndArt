#!/usr/bin/env python3
"""Build the web-facing examples manifest from downloads, citations, and assets."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from example_paths import example_dest_dir, parse_example_name

BOOK_MANIFEST = ROOT / "downloads" / "Musical Composition Craft And Art.json"
DOWNLOADS_DIR = ROOT / "downloads" / "Musical Composition Craft And Art"
CITATIONS_PATH = ROOT / "data" / "citations.json"
UNCITED_PATH = ROOT / "data" / "uncited.json"
OVERRIDES_PATH = ROOT / "data" / "citation_overrides.json"
MOCKUPS_DIR = ROOT / "mockups"
OUTPUT = ROOT / "data" / "examples.json"

COMPOSER_HINT_RE = re.compile(
    r"\b(Bach|Beethoven|Brahms|Mozart|Haydn|Mahler|Tchaikovsky|Sibelius|Chopin|Schubert|"
    r"Schumann|Debussy|Ravel|Stravinsky|Wagner|Verdi|Handel|Vivaldi|Monteverdi|Bartók|"
    r"Shostakovich|Prokofiev|Mendelssohn|Liszt|Dvořák|Elgar|Rachmaninoff|Ravel)\b",
    re.IGNORECASE,
)
ORIGINAL_CITATION = "Original composition by Alan Belkin (uncited in the textbook)."


def load_json(path: Path, default: dict | list | None = None):
    if not path.is_file():
        return default if default is not None else {}
    return json.loads(path.read_text(encoding="utf-8"))


def chapter_number(chapter_name: str) -> int | None:
    if chapter_name == "Extra":
        return None
    match = re.match(r"Chapter (\d+)", chapter_name)
    return int(match.group(1)) if match else None


def example_id_chapter_num(example_id: str) -> int | None:
    match = re.match(r"^Ex(\d+)-", example_id)
    return int(match.group(1)) if match else None


def figure_ref(example_id: str) -> str | None:
    if example_id.startswith("Extra-"):
        return None
    parsed = parse_example_name(example_id)
    ch = example_id_chapter_num(example_id)
    if ch is None:
        return None
    return f"{ch}.{parsed.example_num}"


def example_label(example_id: str) -> str:
    if example_id.startswith("Extra-"):
        num = parse_example_name(example_id).example_num
        return f"Extra Example {num}"
    parsed = parse_example_name(example_id)
    ch = example_id_chapter_num(example_id)
    if parsed.section_num is None:
        return f"Example {parsed.example_num}"
    return f"Example {parsed.example_num}, Section {parsed.section_num}"


def build_slug(chapter_name: str, example_id: str) -> str:
    if chapter_name == "Extra":
        num = parse_example_name(example_id).example_num
        return f"extra/example-{num}"

    ch = chapter_number(chapter_name)
    parsed = parse_example_name(example_id)
    base = f"chapter-{ch}/example-{parsed.example_num}"
    if parsed.section_num is None:
        return base
    return f"{base}/section-{parsed.section_num}"


def route_parts(chapter_name: str, example_id: str) -> dict:
    if chapter_name == "Extra":
        num = parse_example_name(example_id).example_num
        return {"chapter": "extra", "example": str(num)}

    ch = chapter_number(chapter_name)
    parsed = parse_example_name(example_id)
    parts = {"chapter": str(ch), "example": str(parsed.example_num)}
    if parsed.section_num is not None:
        parts["section"] = str(parsed.section_num)
    return parts


def resolve_citation(
    example_id: str,
    citations: dict,
    uncited_ids: set[str],
    overrides: dict[str, str],
) -> tuple[str, str]:
    if example_id in uncited_ids:
        return ORIGINAL_CITATION, "original"

    if example_id in overrides:
        return overrides[example_id], "attributed"

    ref = figure_ref(example_id)
    if ref and ref in citations:
        entry = citations[ref]
        caption = entry.get("caption", "").strip()
        if caption and COMPOSER_HINT_RE.search(caption):
            return caption, "attributed"
        if caption and "," in caption and not caption.lower().startswith("exercise"):
            return caption, "attributed"
        if caption and "exercise" in caption.lower():
            return caption, "exercise"

    return ORIGINAL_CITATION, "original"


def relative_asset_path(chapter_name: str, example_id: str, filename: str) -> str:
    chapter_dir = DOWNLOADS_DIR / chapter_name
    dest_dir = example_dest_dir(chapter_dir, example_id)
    return str(dest_dir.relative_to(DOWNLOADS_DIR) / filename).replace("\\", "/")


def find_mockup_audio(example_id: str, explicit: str | None = None) -> str | None:
    if explicit:
        explicit_path = Path(explicit)
        repo_relative = ROOT / explicit_path
        if repo_relative.is_file():
            return str(explicit_path).replace("\\", "/")

        # Bare filename in JSON (e.g. "Ex4-1.mp3") → look in mockups/.
        in_mockups = MOCKUPS_DIR / explicit_path.name
        if in_mockups.is_file():
            return str(in_mockups.relative_to(ROOT)).replace("\\", "/")

    for ext in (".wav", ".mp3", ".m4a", ".ogg"):
        candidate = MOCKUPS_DIR / f"{example_id}{ext}"
        if candidate.is_file():
            return str(candidate.relative_to(ROOT)).replace("\\", "/")
    return None


def asset_exists(relative_path: str) -> bool:
    return (DOWNLOADS_DIR / relative_path).is_file()


def build_manifest() -> dict:
    book = load_json(BOOK_MANIFEST)
    citations = load_json(CITATIONS_PATH, {})
    uncited = load_json(UNCITED_PATH, {})
    overrides = load_json(OVERRIDES_PATH, {})
    uncited_ids = set(uncited.get("ids", []))

    examples: list[dict] = []
    chapters: list[dict] = []

    for chapter in book["chapters"]:
        chapter_name = chapter["name"]
        ch_num = chapter_number(chapter_name)
        chapter_examples: list[dict] = []

        for example in chapter["examples"]:
            example_id = example["name"]
            image_rel = relative_asset_path(chapter_name, example_id, example["image"])
            midi_rel = relative_asset_path(chapter_name, example_id, example["midi"])
            mockup = find_mockup_audio(example_id, example.get("mockupAudio"))

            citation, citation_kind = resolve_citation(example_id, citations, uncited_ids, overrides)

            entry = {
                "id": example_id,
                "slug": build_slug(chapter_name, example_id),
                "route": route_parts(chapter_name, example_id),
                "chapter": chapter_name,
                "chapterNumber": ch_num,
                "exampleLabel": example_label(example_id),
                "figureRef": figure_ref(example_id),
                "citation": citation,
                "citationKind": citation_kind,
                "assets": {
                    "image": image_rel if asset_exists(image_rel) else None,
                    "midi": midi_rel if asset_exists(midi_rel) else None,
                    "mockupAudio": mockup,
                },
            }
            examples.append(entry)
            chapter_examples.append(
                {
                    "id": example_id,
                    "slug": entry["slug"],
                    "exampleLabel": entry["exampleLabel"],
                    "route": entry["route"],
                }
            )

        chapters.append(
            {
                "name": chapter_name,
                "number": ch_num,
                "slug": "extra" if chapter_name == "Extra" else f"chapter-{ch_num}",
                "exampleCount": len(chapter_examples),
                "examples": chapter_examples,
            }
        )

    return {
        "book": book.get("name", "Musical Composition Craft And Art"),
        "exampleCount": len(examples),
        "chapters": chapters,
        "examples": examples,
    }


def main() -> int:
    if not BOOK_MANIFEST.is_file():
        print(f"Book manifest not found: {BOOK_MANIFEST}", file=sys.stderr)
        return 1

    manifest = build_manifest()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {manifest['exampleCount']} examples to {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
