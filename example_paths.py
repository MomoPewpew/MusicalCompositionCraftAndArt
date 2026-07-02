"""Parse example filenames and build Example/Section folder paths."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

_EX_WITH_PAREN_SECTION = re.compile(r"^Ex\d+-(\d+)-\((\d+)\)$")
_EX_WITH_DASH_SECTION = re.compile(r"^Ex\d+-(\d+)-(\d+)$")
_EX_ONLY = re.compile(r"^Ex\d+-(\d+)$")
_EXTRA = re.compile(r"^Extra-(\d+)$")


@dataclass(frozen=True)
class ParsedExample:
    example_num: int
    section_num: int | None


def parse_example_name(name: str) -> ParsedExample:
    match _EX_WITH_PAREN_SECTION.match(name):
        case None:
            pass
        case m:
            return ParsedExample(int(m.group(1)), int(m.group(2)))

    match _EX_WITH_DASH_SECTION.match(name):
        case None:
            pass
        case m:
            return ParsedExample(int(m.group(1)), int(m.group(2)))

    match _EX_ONLY.match(name):
        case None:
            pass
        case m:
            return ParsedExample(int(m.group(1)), None)

    match _EXTRA.match(name):
        case None:
            pass
        case m:
            return ParsedExample(int(m.group(1)), None)

    raise ValueError(f"Unrecognized example name: {name}")


def example_dest_dir(chapter_dir: Path, example_name: str) -> Path:
    parsed = parse_example_name(example_name)
    dest = chapter_dir / f"Example {parsed.example_num}"
    if parsed.section_num is not None:
        dest = dest / f"Section {parsed.section_num}"
    return dest


def example_asset_names(example_name: str) -> list[str]:
    return [
        f"{example_name}.mid",
        f"{example_name}.png",
        f"{example_name}.musicxml",
    ]
