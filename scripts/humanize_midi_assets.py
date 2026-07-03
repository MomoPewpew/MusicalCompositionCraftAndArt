#!/usr/bin/env python3
"""
Humanize MIDI assets with midihum (velocity/dynamics ML model).

Reads tempo-corrected MIDI from downloads/Musical Composition Craft And Art/
and writes humanized copies to downloads/Musical Composition Craft And Art.humanized/
without modifying the originals.

Requires a local midihum checkout. Set MIDIHUM_DIR or use the default search paths.

Examples:
  python3 scripts/humanize_midi_assets.py
  python3 scripts/humanize_midi_assets.py --force
  MIDIHUM_DIR=/path/to/midihum python3 scripts/humanize_midi_assets.py
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS_DIR = ROOT / "downloads" / "Musical Composition Craft And Art"
HUMANIZED_DIR = ROOT / "downloads" / "Musical Composition Craft And Art.humanized"
MANIFEST_PATH = ROOT / "data" / "examples.json"
PATCH_PATH = ROOT / "scripts" / "patches" / "midihum-short-excerpts.patch"

DEFAULT_MIDIHUM_CANDIDATES = [
    Path("/mnt/files/Workspaces/workspace-py/midihum"),
    ROOT.parent.parent / "workspace-py" / "midihum",
    ROOT / "vendor" / "midihum",
]


def find_midihum_dir(explicit: str | None) -> Path:
    if explicit:
        path = Path(explicit).resolve()
        if not (path / "main.py").is_file():
            raise FileNotFoundError(f"MIDIHUM_DIR is not a midihum checkout: {path}")
        return path

    env = os.environ.get("MIDIHUM_DIR")
    if env:
        return find_midihum_dir(env)

    for candidate in DEFAULT_MIDIHUM_CANDIDATES:
        if (candidate / "main.py").is_file():
            return candidate.resolve()

    raise FileNotFoundError(
        "midihum not found. Clone https://github.com/erwald/midihum and set MIDIHUM_DIR."
    )


def ensure_midihum_patched(midihum_dir: Path) -> None:
    target = midihum_dir / "midi_to_df_conversion.py"
    if "min_periods=1" in target.read_text(encoding="utf-8"):
        return
    if not PATCH_PATH.is_file():
        raise FileNotFoundError(f"Missing midihum patch: {PATCH_PATH}")
    subprocess.run(
        ["patch", "-p1", "-i", str(PATCH_PATH)],
        cwd=midihum_dir,
        check=True,
    )


def ensure_midihum_venv(midihum_dir: Path) -> Path:
    venv_python = midihum_dir / ".venv" / "bin" / "python"
    if venv_python.is_file():
        return venv_python

    subprocess.run([sys.executable, "-m", "venv", str(midihum_dir / ".venv")], check=True)
    subprocess.run(
        [str(venv_python), "-m", "pip", "install", "-q", "-r", "requirements.txt"],
        cwd=midihum_dir,
        check=True,
    )
    return venv_python


def midi_paths_from_manifest(downloads_dir: Path) -> list[Path]:
    if not MANIFEST_PATH.is_file():
        return sorted(downloads_dir.rglob("*.mid"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    paths: list[Path] = []
    for example in manifest.get("examples", []):
        rel = example.get("assets", {}).get("midi")
        if rel:
            paths.append(downloads_dir / rel)
    return paths


def run_in_midihum_venv(
    midihum_dir: Path,
    sources: list[Path],
    downloads_dir: Path,
    humanized_dir: Path,
    force: bool,
) -> int:
    """Run humanization inside midihum's venv (separate dependency tree)."""
    ensure_midihum_patched(midihum_dir)
    python = ensure_midihum_venv(midihum_dir)
    worker = ROOT / "scripts" / "_humanize_worker.py"
    cmd = [
        str(python),
        str(worker),
        "--midihum-dir",
        str(midihum_dir),
        "--downloads",
        str(downloads_dir),
        "--output",
        str(humanized_dir),
        "--sources-json",
        json.dumps([str(p) for p in sources]),
    ]
    if force:
        cmd.append("--force")
    return subprocess.run(cmd, cwd=midihum_dir).returncode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--midihum-dir", help="Path to midihum checkout (overrides MIDIHUM_DIR)")
    parser.add_argument("--force", action="store_true", help="Regenerate all humanized files")
    parser.add_argument("--downloads", type=Path, default=DOWNLOADS_DIR)
    parser.add_argument("--output", type=Path, default=HUMANIZED_DIR)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    downloads_dir = args.downloads.resolve()
    humanized_dir = args.output.resolve()

    midihum_dir = find_midihum_dir(args.midihum_dir)
    sources = midi_paths_from_manifest(downloads_dir)
    if not sources:
        print("No MIDI files found.", file=sys.stderr)
        return 1

    print(f"midihum: {midihum_dir}")
    print(f"source:  {downloads_dir}")
    print(f"output:  {humanized_dir}")
    print(f"files:   {len(sources)}")

    started = time.time()
    code = run_in_midihum_venv(
        midihum_dir, sources, downloads_dir, humanized_dir, args.force
    )
    print(f"Finished in {time.time() - started:.1f}s")
    if code == 0:
        print("Next: cd web && npm run build")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
