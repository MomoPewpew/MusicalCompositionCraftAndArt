#!/usr/bin/env python3
"""Download Belkin playlist captions and match videos to book chapters.

Uses:
- Video titles from Alan Belkin's "Musical Composition" YouTube playlist
- Downloaded auto-captions (cached locally)
- Chapter titles from data/chapter-titles.json
- Full chapter prose from the EPUB splits (same source as extract_citations.py)

Output: data/belkin-playlist-matches.json (for human review before editing teaching-videos.json)
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import zipfile
from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAPTER_TITLES_PATH = ROOT / "data" / "chapter-titles.json"
CITATIONS_PATH = ROOT / "data" / "citations.json"
SPLITS_DIR = Path("/mnt/files/Documents/Torrents/Books/Musical Composition/Splits")
CAPTIONS_DIR = ROOT / "data" / "youtube-captions" / "belkin-musical-composition"
OUTPUT_PATH = ROOT / "data" / "belkin-playlist-matches.json"

PLAYLIST_ID = "PLSntcNF64SVVhPiEzHVIjIP0TvutZhK8J"
PLAYLIST_URL = f"https://www.youtube.com/playlist?list={PLAYLIST_ID}"

CHAPTER_EPUB_RE = re.compile(r"^(\d+) - (\d+)\. .+\.epub$", re.IGNORECASE)
STOPWORDS = {
    "about", "after", "also", "because", "been", "before", "being", "between",
    "both", "but", "can", "could", "does", "each", "even", "every", "example",
    "figure", "first", "for", "from", "have", "here", "how", "into", "just",
    "like", "make", "many", "more", "most", "much", "music", "musical", "not",
    "note", "notes", "one", "only", "other", "our", "out", "over", "part", "piece",
    "same", "some", "such", "than", "that", "the", "their", "them", "then",
    "there", "these", "they", "this", "through", "very", "was", "way", "well",
    "what", "when", "where", "which", "while", "will", "with", "would", "your",
    "and", "are", "all", "any", "art", "belkin", "book", "chapter", "composer",
    "composition", "craft", "crafts", "discuss", "lecture", "look", "new", "on",
    "see", "talk", "think", "today", "video", "why",
}

TITLE_ALIASES: dict[str, list[int]] = {
    "motive": [1],
    "motives": [1],
    "phrase": [2],
    "singing": [3],
    "playing": [4],
    "punctuation": [5],
    "punctuating": [5],
    "breathing": [5],
    "presenting": [6],
    "one part form": [7],
    "one-part form": [7],
    "one part forms": [7],
    "ternary": [8],
    "binary form": [9],
    "variation form": [9],
    "variation": [10],
    "contrasting": [11],
    "contrast": [11],
    "connecting": [12],
    "transition": [12],
    "transitions": [12],
    "progressing": [13],
    "progression": [13],
    "rondo": [14],
    "beginning": [15],
    "beginnings": [15],
    "exploring": [16],
    "returning": [17],
    "recapitulation": [17],
    "ending": [18],
    "endings": [18],
    "sonata form": [19],
    "sonata": [19],
    "refinement": [20],
    "refinements": [20],
    "fugue": [19],
    "climax": [13],
    "repetition": [14],
    "modulation": [19],
    "form checklist": [20],
    "orchestration checklist": [20],
    "counterpoint checklist": [20],
}


@dataclass
class PlaylistVideo:
    index: int
    video_id: str
    title: str
    url: str
    topic: str
    transcript: str


@dataclass
class ChapterProfile:
    number: int
    title: str
    text: str
    keywords: set[str]


def run_yt_dlp(args: list[str]) -> subprocess.CompletedProcess[str]:
    command = ["yt-dlp", "--no-update", *args]
    return subprocess.run(command, capture_output=True, text=True, check=False)


def list_playlist_videos() -> list[tuple[int, str, str]]:
    result = run_yt_dlp(
        [
            "--flat-playlist",
            "--print",
            "%(playlist_index)s|%(id)s|%(title)s",
            PLAYLIST_URL,
        ]
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "yt-dlp failed listing playlist")

    videos: list[tuple[int, str, str]] = []
    for line in result.stdout.splitlines():
        if "|" not in line:
            continue
        index_raw, video_id, title = line.split("|", 2)
        videos.append((int(index_raw), video_id, title.strip()))
    return videos


def download_captions(video_id: str, dest_dir: Path) -> Path | None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    existing = list(dest_dir.glob(f"{video_id}.*.vtt")) + list(dest_dir.glob(f"{video_id}.*.srt"))
    if existing:
        return existing[0]

    output_template = str(dest_dir / f"{video_id}.%(ext)s")
    result = run_yt_dlp(
        [
            "--write-auto-sub",
            "--sub-lang",
            "en",
            "--skip-download",
            "--sub-format",
            "vtt",
            "-o",
            output_template,
            f"https://www.youtube.com/watch?v={video_id}",
        ]
    )
    if result.returncode != 0:
        return None

    downloaded = list(dest_dir.glob(f"{video_id}.*.vtt"))
    return downloaded[0] if downloaded else None


def parse_vtt(path: Path) -> str:
    lines: list[str] = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line == "WEBVTT":
            continue
        if re.match(r"^\d+$", line):
            continue
        if re.match(r"^\d{2}:\d{2}:\d{2}\.", line):
            continue
        if "-->" in line:
            continue
        cleaned = re.sub(r"<[^>]+>", "", line)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if cleaned:
            lines.append(cleaned)
    return " ".join(lines)


def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for token in normalize_text(text).split():
        if len(token) < 3 or token in STOPWORDS:
            continue
        tokens.append(token)
    return tokens


def extract_topic_from_title(title: str) -> str:
    topic = re.sub(r"^Musical Composition(?:, Craft and Art|, Craft an Art|, Craft and Art)?\s*#?\s*\d+\s*[-–—]?\s*", "", title, flags=re.I)
    topic = re.sub(r"^Musical Composition Craft and Art\s*[-–—]\s*#\s*\d+\s*[-–—]\s*", "", topic, flags=re.I)
    topic = re.sub(r"^Musical Composition\s*#\d+\s*[-–—]?\s*", "", topic, flags=re.I)
    return topic.strip(" -–—")


class ChapterTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._capture = False
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "p":
            return
        attr = {k: v for k, v in attrs if k and v is not None}
        cls = attr.get("class", "")
        if any(key in cls for key in ("C260", "C266", "C267", "C241")):
            self._capture = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "p":
            self._capture = False

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if self._capture and text:
            self._parts.append(text)


def chapter_epubs() -> list[tuple[int, Path]]:
    chapters: list[tuple[int, Path]] = []
    for path in sorted(SPLITS_DIR.glob("*.epub")):
        match = CHAPTER_EPUB_RE.match(path.name)
        if match:
            chapters.append((int(match.group(2)), path))
    return chapters


def extract_chapter_text(chapter_num: int, epub_path: Path) -> str:
    with zipfile.ZipFile(epub_path) as archive:
        html_names = [name for name in archive.namelist() if name.endswith(".html") and "/xhtml/" in name]
        if not html_names:
            return ""
        html = archive.read(html_names[0]).decode("utf-8", errors="replace")

    parser = ChapterTextExtractor()
    parser.feed(html)
    return " ".join(parser._parts)


def load_citation_prose_by_chapter() -> dict[int, str]:
    if not CITATIONS_PATH.is_file():
        return {}
    citations = json.loads(CITATIONS_PATH.read_text(encoding="utf-8"))
    by_chapter: dict[int, list[str]] = {}
    for entry in citations.values():
        chapter = entry.get("chapter")
        if chapter is None:
            continue
        prose_parts = entry.get("proseAttribution") or []
        by_chapter.setdefault(int(chapter), []).extend(prose_parts)
    return {chapter: " ".join(parts) for chapter, parts in by_chapter.items()}


def chapter_keywords(text: str, title: str, limit: int = 80) -> set[str]:
    counts = Counter(tokenize(text))
    for word in tokenize(title):
        counts[word] += 5
    ranked = [word for word, _count in counts.most_common(limit)]
    return set(ranked)


def build_chapter_profiles() -> dict[int, ChapterProfile]:
    titles = json.loads(CHAPTER_TITLES_PATH.read_text(encoding="utf-8"))["chapters"]
    citation_prose = load_citation_prose_by_chapter()
    profiles: dict[int, ChapterProfile] = {}

    epub_text: dict[int, str] = {}
    if SPLITS_DIR.is_dir():
        for chapter_num, epub_path in chapter_epubs():
            epub_text[chapter_num] = extract_chapter_text(chapter_num, epub_path)

    for chapter_key, title in titles.items():
        chapter_num = int(chapter_key)
        parts = [title, epub_text.get(chapter_num, ""), citation_prose.get(chapter_num, "")]
        text = " ".join(part for part in parts if part).strip()
        profiles[chapter_num] = ChapterProfile(
            number=chapter_num,
            title=title,
            text=text,
            keywords=chapter_keywords(text, title),
        )
    return profiles


def alias_chapters(topic: str, transcript: str) -> dict[int, float]:
    haystack = normalize_text(f"{topic} {transcript}")
    scores: dict[int, float] = {}
    for phrase, chapters in TITLE_ALIASES.items():
        if phrase in haystack:
            for chapter in chapters:
                scores[chapter] = max(scores.get(chapter, 0.0), 0.85 if phrase in normalize_text(topic) else 0.55)
    return scores


def title_similarity(topic: str, chapter_title: str) -> float:
    topic_norm = normalize_text(topic)
    chapter_norm = normalize_text(chapter_title)
    if not topic_norm or not chapter_norm:
        return 0.0

    ratio = SequenceMatcher(None, topic_norm, chapter_norm).ratio()
    topic_tokens = set(tokenize(topic))
    chapter_tokens = set(tokenize(chapter_title))
    overlap = len(topic_tokens & chapter_tokens) / max(len(chapter_tokens), 1)
    substring_bonus = 0.25 if chapter_norm in topic_norm or topic_norm in chapter_norm else 0.0
    return min(1.0, ratio * 0.45 + overlap * 0.45 + substring_bonus)


def keyword_overlap_score(tokens: list[str], keywords: set[str]) -> float:
    if not tokens or not keywords:
        return 0.0
    token_set = set(tokens)
    hits = len(token_set & keywords)
    return min(1.0, hits / max(len(keywords) * 0.25, 1.0))


def text_overlap_score(tokens: list[str], chapter_text: str) -> float:
    if not tokens or not chapter_text:
        return 0.0
    token_set = set(tokens)
    chapter_tokens = set(tokenize(chapter_text))
    if not chapter_tokens:
        return 0.0
    overlap = len(token_set & chapter_tokens)
    return min(1.0, overlap / max(len(token_set) * 0.2, 1.0))


def score_video_against_chapters(video: PlaylistVideo, profiles: dict[int, ChapterProfile]) -> list[dict]:
    topic = video.topic
    transcript_tokens = tokenize(video.transcript)
    alias_scores = alias_chapters(topic, video.transcript)

    results: list[dict] = []
    for chapter_num, profile in sorted(profiles.items()):
        title_score = title_similarity(topic, profile.title)
        keyword_score = keyword_overlap_score(transcript_tokens, profile.keywords)
        prose_score = text_overlap_score(transcript_tokens, profile.text)
        alias_score = alias_scores.get(chapter_num, 0.0)

        confidence = min(
            1.0,
            title_score * 0.40
            + keyword_score * 0.25
            + prose_score * 0.15
            + alias_score * 0.20,
        )
        reasons: list[str] = []
        if title_score >= 0.35:
            reasons.append(f"title overlap ({title_score:.2f})")
        if keyword_score >= 0.12:
            reasons.append(f"caption keywords ({keyword_score:.2f})")
        if prose_score >= 0.08:
            reasons.append(f"ebook prose ({prose_score:.2f})")
        if alias_score > 0:
            reasons.append(f"topic alias ({alias_score:.2f})")

        results.append(
            {
                "chapter": chapter_num,
                "chapterTitle": profile.title,
                "confidence": round(confidence, 3),
                "scores": {
                    "title": round(title_score, 3),
                    "keywords": round(keyword_score, 3),
                    "prose": round(prose_score, 3),
                    "alias": round(alias_score, 3),
                },
                "reasons": reasons,
            }
        )

    results.sort(key=lambda item: item["confidence"], reverse=True)
    return results


def load_videos(download: bool) -> list[PlaylistVideo]:
    videos: list[PlaylistVideo] = []
    for index, video_id, title in list_playlist_videos():
        caption_path = None
        if download:
            caption_path = download_captions(video_id, CAPTIONS_DIR)
        else:
            matches = list(CAPTIONS_DIR.glob(f"{video_id}.*.vtt"))
            caption_path = matches[0] if matches else None

        transcript = parse_vtt(caption_path) if caption_path else ""
        videos.append(
            PlaylistVideo(
                index=index,
                video_id=video_id,
                title=title,
                url=f"https://www.youtube.com/watch?v={video_id}",
                topic=extract_topic_from_title(title),
                transcript=transcript,
            )
        )
    return videos


def build_matches(videos: list[PlaylistVideo], profiles: dict[int, ChapterProfile]) -> dict:
    matches = []
    for video in videos:
        ranked = score_video_against_chapters(video, profiles)
        best = ranked[0] if ranked else None
        second = ranked[1] if len(ranked) > 1 else None
        margin = round(best["confidence"] - second["confidence"], 3) if best and second else None
        matches.append(
            {
                "playlistIndex": video.index,
                "videoId": video.video_id,
                "title": video.title,
                "topic": video.topic,
                "url": video.url,
                "hasTranscript": bool(video.transcript),
                "transcriptWords": len(tokenize(video.transcript)),
                "bestMatch": best,
                "matchMargin": margin,
                "topMatches": ranked[:5],
            }
        )

    by_chapter: dict[str, list[dict]] = {}
    for entry in matches:
        best = entry.get("bestMatch")
        margin = entry.get("matchMargin") or 0.0
        if not best:
            continue
        strong = best["confidence"] >= 0.55 or (best["confidence"] >= 0.45 and margin >= 0.08)
        if not strong:
            continue
        chapter_key = str(best["chapter"])
        by_chapter.setdefault(chapter_key, []).append(
            {
                "videoId": entry["videoId"],
                "title": entry["title"],
                "url": entry["url"],
                "confidence": best["confidence"],
                "margin": margin,
                "reasons": best["reasons"],
            }
        )

    for chapter_videos in by_chapter.values():
        chapter_videos.sort(key=lambda item: item["confidence"], reverse=True)

    return {
        "playlistId": PLAYLIST_ID,
        "playlistUrl": PLAYLIST_URL,
        "videoCount": len(matches),
        "captionsDir": str(CAPTIONS_DIR.relative_to(ROOT)),
        "videos": matches,
        "byChapter": by_chapter,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download-only", action="store_true", help="Download captions and exit")
    parser.add_argument("--match-only", action="store_true", help="Use cached captions; skip download")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    if not CHAPTER_TITLES_PATH.is_file():
        print(f"Missing chapter titles: {CHAPTER_TITLES_PATH}", file=sys.stderr)
        return 1

    download = not args.match_only
    videos = load_videos(download=download)
    downloaded = sum(1 for video in videos if video.transcript)
    print(f"Playlist videos: {len(videos)} ({downloaded} with captions)")

    if args.download_only:
        return 0

    profiles = build_chapter_profiles()
    print(f"Chapter profiles: {len(profiles)}")

    payload = build_matches(videos, profiles)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")

    suggested = sum(
        1
        for video in payload["videos"]
        if video.get("bestMatch", {}).get("confidence", 0) >= 0.45
    )
    print(f"Suggested chapter matches (confidence >= 0.45): {suggested}/{len(videos)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
