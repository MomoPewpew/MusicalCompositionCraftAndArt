#!/usr/bin/env python3
"""Infer playback tempo (BPM) from example citations and textbook prose."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CITATIONS_PATH = ROOT / "data" / "citations.json"
OVERRIDES_PATH = ROOT / "data" / "tempo_overrides.json"

DEFAULT_ORIGINAL_BPM = 96
DEFAULT_EXERCISE_BPM = 100

# Typical dance / movement tempos (historical performance practice, rounded for MIDI).
MOVEMENT_PATTERNS: list[tuple[re.Pattern[str], int, str]] = [
    (re.compile(r"\bintroduction\b", re.I), 76, "introduction"),
    (re.compile(r"\bpavane\b", re.I), 60, "pavane"),
    (re.compile(r"\blargo\b", re.I), 50, "largo"),
    (re.compile(r"\badagio\b", re.I), 66, "adagio"),
    (re.compile(r"\bprelude\b", re.I), 72, "prelude"),
    (re.compile(r"\bandante\b", re.I), 76, "andante"),
    (re.compile(r"\ballemande\b", re.I), 80, "allemande"),
    (re.compile(r"\bfugue\b", re.I), 84, "fugue"),
    (re.compile(r"\bwaltz\b", re.I), 90, "waltz"),
    (re.compile(r"\bvals(es)?\b", re.I), 90, "vals"),
    (re.compile(r"\bländler\b", re.I), 100, "ländler"),
    (re.compile(r"\blandler\b", re.I), 100, "landler"),
    (re.compile(r"\btrio\b", re.I), 104, "trio"),
    (re.compile(r"\bmenuetto\b", re.I), 112, "menuetto"),
    (re.compile(r"\bmenuet\b", re.I), 112, "menuet"),
    (re.compile(r"\bminuet\b", re.I), 112, "minuet"),
    (re.compile(r"\bminuetto\b", re.I), 112, "minuetto"),
    (re.compile(r"\brondo\b", re.I), 108, "rondo"),
    (re.compile(r"\ballegro\b", re.I), 120, "allegro"),
    (re.compile(r"\bscherzo\b", re.I), 140, "scherzo"),
    (re.compile(r"\bvivace\b", re.I), 144, "vivace"),
    (re.compile(r"\bpresto\b", re.I), 168, "presto"),
]

PROSE_TEMPO_PATTERNS: list[tuple[re.Pattern[str], int, str]] = [
    (re.compile(r"\bslow, lyrical\b", re.I), 72, "prose:slow lyrical"),
    (re.compile(r"\bslow tempo\b", re.I), 60, "prose:slow tempo"),
    (re.compile(r"\bvery slow\b", re.I), 56, "prose:very slow"),
]

# Common export defaults from the source MIDI set that often sound wrong for excerpts.
SUSPECT_DEFAULT_BPMS = {108, 140, 145, 150}


def load_json(path: Path, default: dict | None = None) -> dict:
    if not path.is_file():
        return default or {}
    return json.loads(path.read_text(encoding="utf-8"))


def movement_tempo_from_text(text: str) -> tuple[int, str] | None:
    for pattern, bpm, label in MOVEMENT_PATTERNS:
        if pattern.search(text):
            return bpm, f"movement:{label}"
    return None


def prose_tempo_from_text(text: str) -> tuple[int, str] | None:
    for pattern, bpm, label in PROSE_TEMPO_PATTERNS:
        if pattern.search(text):
            return bpm, label
    return None


def figure_prose(citations: dict, figure_ref: str | None) -> str:
    if not figure_ref or figure_ref not in citations:
        return ""
    paragraphs = citations[figure_ref].get("proseAttribution", [])
    return "\n".join(paragraphs)


def infer_tempo(
    example: dict,
    *,
    citations: dict | None = None,
    overrides: dict[str, int] | None = None,
    current_bpm: int | None = None,
) -> tuple[int | None, str]:
    """
    Return (recommended_bpm, reason) or (None, reason) if the MIDI should be left as-is.
    """
    example_id = example["id"]
    citation = example.get("citation", "")
    kind = example.get("citationKind", "")
    figure_ref = example.get("figureRef")

    if overrides is None:
        overrides = load_json(OVERRIDES_PATH, {})
    if citations is None:
        citations = load_json(CITATIONS_PATH, {})

    if example_id in overrides:
        return int(overrides[example_id]), "override"

    movement = movement_tempo_from_text(citation)
    if movement and kind == "attributed":
        return movement

    prose = figure_prose(citations, figure_ref)
    prose_hint = prose_tempo_from_text(prose)
    if prose_hint and kind == "attributed":
        if current_bpm is None or current_bpm >= 90:
            return prose_hint

    if kind == "original":
        if current_bpm is None or current_bpm in SUSPECT_DEFAULT_BPMS:
            return DEFAULT_ORIGINAL_BPM, "default:belkin original"
        return None, "keep:original"

    if kind == "exercise":
        if current_bpm is None or current_bpm in SUSPECT_DEFAULT_BPMS:
            return DEFAULT_EXERCISE_BPM, "default:exercise"
        return None, "keep:exercise"

    return None, "keep:no inference"
