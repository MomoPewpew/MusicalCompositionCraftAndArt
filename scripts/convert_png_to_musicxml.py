#!/usr/bin/env python3
"""
Convert textbook PNG scores to MusicXML using Audiveris OMR.

Reads sheet-music images from downloads/ and writes .musicxml alongside each PNG.
Audiveris project files (.omr) are stored under data/omr-cache/ for re-export without
re-running recognition.

Textbook PNGs are fairly low resolution; by default each image is upscaled before OMR.

Requires a local Audiveris install:
  https://audiveris.github.io/audiveris/_pages/tutorials/install/binaries/

Flatpak (recommended on Linux):
  flatpak install flathub org.audiveris.audiveris

Examples:
  python3 scripts/convert_png_to_musicxml.py --dry-run
  python3 scripts/convert_png_to_musicxml.py --limit 2
  python3 scripts/convert_png_to_musicxml.py --force --batch-size 1
  python3 scripts/convert_png_to_musicxml.py --retry-failures
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "downloads" / "Musical Composition Craft And Art"
OMR_CACHE_DIR = ROOT / "data" / "omr-cache"
OMR_RESULTS_PATH = ROOT / "data" / "omr-results.json"
OMR_LOG_DIR = OMR_CACHE_DIR / "logs"
OMR_MAX_OUTPUT_DIM = 3600
OMR_PAD_RATIO = 0.10
OMR_MIN_PAD_PX = 48
CONTAINER_NS = {"c": "urn:oasis:names:tc:opendocument:xmlns:container"}
TESSDATA_URL = "https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata"
FLATPAK_APP_ID = "org.audiveris.audiveris"

AUDIVERIS_CANDIDATES = [
    Path("/opt/audiveris/bin/Audiveris"),
    Path("/usr/bin/audiveris"),
    Path("/usr/bin/Audiveris"),
]


@dataclass(frozen=True)
class AudiverisRunner:
    argv_prefix: list[str]
    is_flatpak: bool
    tessdata_dir: Path | None = None


@dataclass(frozen=True)
class ConvertTask:
    png: Path
    musicxml: Path
    omr: Path


def flatpak_installed() -> bool:
    if not shutil.which("flatpak"):
        return False
    result = subprocess.run(
        ["flatpak", "info", FLATPAK_APP_ID],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def resolve_audiveris(explicit: str | None) -> AudiverisRunner:
    if explicit:
        cmd = shlex.split(explicit)
    elif env := os.environ.get("AUDIVERIS_BIN"):
        cmd = shlex.split(env)
    elif flatpak_installed():
        cmd = ["flatpak", "run", FLATPAK_APP_ID]
    else:
        cmd = None
        for candidate in AUDIVERIS_CANDIDATES:
            if candidate.is_file():
                cmd = [str(candidate)]
                break
        if cmd is None:
            for name in ("audiveris", "Audiveris"):
                found = shutil.which(name)
                if found:
                    cmd = [found]
                    break
        if cmd is None:
            raise FileNotFoundError(
                "Audiveris not found. Install from https://github.com/Audiveris/audiveris/releases "
                "or `flatpak install flathub org.audiveris.audiveris`, then set AUDIVERIS_BIN."
            )

    is_flatpak = len(cmd) >= 3 and cmd[0] == "flatpak" and cmd[1] == "run"
    tessdata_dir = (
        Path.home() / ".var/app" / FLATPAK_APP_ID / "config/tessdata" if is_flatpak else None
    )
    return AudiverisRunner(argv_prefix=cmd, is_flatpak=is_flatpak, tessdata_dir=tessdata_dir)


def ensure_tesseract_eng(runner: AudiverisRunner) -> None:
    candidates = []
    if runner.tessdata_dir:
        candidates.append(runner.tessdata_dir)
    candidates.append(Path.home() / ".audiveris" / "tessdata")

    for tessdir in candidates:
        target = tessdir / "eng.traineddata"
        if target.is_file() and target.stat().st_size > 20_000_000:
            return
        tessdir.mkdir(parents=True, exist_ok=True)
        print(f"Downloading legacy eng.traineddata to {tessdir}")
        urllib.request.urlretrieve(TESSDATA_URL, target)
        return


def discover_pngs(input_dir: Path) -> list[ConvertTask]:
    tasks: list[ConvertTask] = []
    for png in sorted(input_dir.rglob("*.png")):
        if png.name.endswith(".e7mac.png"):
            continue
        rel = png.relative_to(input_dir)
        tasks.append(
            ConvertTask(
                png=png,
                musicxml=png.with_suffix(".musicxml"),
                omr=OMR_CACHE_DIR / rel.with_suffix(".omr"),
            )
        )
    return tasks


def needs_work(task: ConvertTask, force: bool) -> bool:
    if force or not task.musicxml.is_file():
        return True
    return task.png.stat().st_mtime > task.musicxml.stat().st_mtime


def omr_scale_factor(width: int, height: int, base_scale: float) -> float:
    max_dim = max(width, height)
    min_dim = min(width, height)

    if max_dim >= 1600:
        scale = 1.0
    elif max_dim >= 750:
        scale = min(base_scale, 2.0)
    else:
        scale = base_scale

    # Cropped textbook panels can be very short; Audiveris needs taller bitmaps.
    if min_dim < 400:
        scale = max(scale, 1000 / min_dim)
    elif min_dim < 550:
        scale = max(scale, 1500 / min_dim)
    elif min_dim < 650:
        scale = max(scale, 750 / min_dim)

    # Wide EPUB strips are already ~900px across; upscaling hurts interline detection.
    if width >= 750 and width / max(height, 1) > 2.5:
        scale = min(scale, 1.0)

    return min(scale, 6.0)


def flatten_for_omr(image: "Image.Image") -> "Image.Image":
    from PIL import Image

    if image.mode == "RGBA":
        background = Image.new("RGB", image.size, (255, 255, 255))
        background.paste(image, mask=image.split()[3])
        return background
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def pad_for_omr(image: "Image.Image") -> "Image.Image":
    from PIL import Image

    width, height = image.size
    pad_x = max(OMR_MIN_PAD_PX, round(width * OMR_PAD_RATIO))
    pad_y = max(OMR_MIN_PAD_PX, round(height * OMR_PAD_RATIO))

    if width / max(height, 1) > 2.5:
        pad_y = max(pad_y, round(height * 0.20))
    if height / max(width, 1) > 2.5:
        pad_x = max(pad_x, round(width * 0.20))
    if min(width, height) < 200:
        pad_x = max(pad_x, 150)
        pad_y = max(pad_y, 200)

    canvas = Image.new("RGB", (width + 2 * pad_x, height + 2 * pad_y), (255, 255, 255))
    canvas.paste(image, (pad_x, pad_y))
    return canvas


def cap_omr_scale(width: int, height: int, scale: float) -> float:
    max_dim = max(width, height)
    if max_dim * scale > OMR_MAX_OUTPUT_DIM:
        scale = OMR_MAX_OUTPUT_DIM / max_dim
    return max(scale, 1.0)


def prepare_png_for_omr(png: Path, work_dir: Path, scale: float) -> Path:
    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "Pillow is required for PNG upscaling. Install with: pip install Pillow"
        ) from exc

    out = work_dir / png.name
    with Image.open(png) as img:
        prepared = pad_for_omr(flatten_for_omr(img))
        width, height = prepared.size
        effective_scale = cap_omr_scale(width, height, omr_scale_factor(width, height, scale))
        if effective_scale <= 1.0:
            prepared.save(out)
            return out

        resized = prepared.resize(
            (
                max(1, round(width * effective_scale)),
                max(1, round(height * effective_scale)),
            ),
            Image.Resampling.LANCZOS,
        )
        resized.save(out)
    return out


def extract_musicxml_from_mxl(mxl_path: Path) -> bytes:
    with zipfile.ZipFile(mxl_path) as archive:
        container_xml = archive.read("META-INF/container.xml")
        container = ET.fromstring(container_xml)
        rootfile = container.find("c:rootfiles/c:rootfile", CONTAINER_NS)
        if rootfile is None:
            rootfile = container.find(".//rootfile")
        if rootfile is None:
            raise ValueError(f"No rootfile in {mxl_path}")
        inner_name = rootfile.attrib["full-path"]
        return archive.read(inner_name)


def summarize_audiveris_output(stdout: str, stderr: str) -> str:
    text = stdout + "\n" + stderr
    for pattern in (
        r"Exception on [^,]+, (.+)$",
        r"Exception occurred (.+)$",
        r"No system found[^\\n]*",
        r"interline[^\n]*",
        r"Error in reaching step \w+",
        r"ArrayIndexOutOfBoundsException[^\n]*",
    ):
        if match := re.search(pattern, text, re.MULTILINE):
            return match.group(0).strip()
    for line in text.splitlines():
        if "WARN" in line and any(
            key in line for key in ("Exception", "Error", "No system", "interline")
        ):
            return line.strip()
    return "Audiveris failed (use --verbose for full log)"


def write_audiveris_log(stem: str, stdout: str, stderr: str) -> Path:
    OMR_LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = OMR_LOG_DIR / f"{stem}.log"
    log_path.write_text(stdout + stderr, encoding="utf-8")
    return log_path


def build_audiveris_command(
    runner: AudiverisRunner,
    *,
    output_dir: Path,
    input_paths: list[Path],
    filesystems: list[Path],
) -> list[str]:
    cmd: list[str] = []
    if runner.is_flatpak:
        cmd.extend(["flatpak", "run"])
        for path in filesystems:
            cmd.append(f"--filesystem={path.resolve()}")
        cmd.append(FLATPAK_APP_ID)
    else:
        cmd.extend(runner.argv_prefix)

    cmd.extend(
        [
            "-batch",
            "-transcribe",
            "-export",
            "-output",
            str(output_dir.resolve()),
            "-constant",
            "org.audiveris.omr.sheet.BookManager.useSeparateBookFolders=false",
        ]
    )
    cmd.extend(str(path.resolve()) for path in input_paths)
    return cmd


def run_audiveris_batch(
    runner: AudiverisRunner,
    pngs: list[Path],
    output_dir: Path,
    *,
    filesystems: list[Path],
) -> subprocess.CompletedProcess[str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = build_audiveris_command(
        runner,
        output_dir=output_dir,
        input_paths=pngs,
        filesystems=filesystems,
    )
    return subprocess.run(cmd, capture_output=True, text=True)


def finalize_task(task: ConvertTask, work_dir: Path) -> None:
    stem = task.png.stem
    mxl = work_dir / f"{stem}.mxl"
    omr_src = work_dir / f"{stem}.omr"

    if not mxl.is_file():
        raise FileNotFoundError(f"Audiveris did not produce {mxl.name}")

    task.musicxml.parent.mkdir(parents=True, exist_ok=True)
    task.musicxml.write_bytes(extract_musicxml_from_mxl(mxl))

    if omr_src.is_file():
        task.omr.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(omr_src, task.omr)


def load_retry_failures() -> tuple[list[str], dict]:
    if not OMR_RESULTS_PATH.is_file():
        raise FileNotFoundError(f"No results file at {OMR_RESULTS_PATH}")
    payload = json.loads(OMR_RESULTS_PATH.read_text(encoding="utf-8"))
    failed = [row["file"] for row in payload.get("results", {}).get("failed", [])]
    return failed, payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "-i",
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Directory to scan for .png files (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--audiveris-bin",
        help="Audiveris executable or command (overrides AUDIVERIS_BIN)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1,
        help="PNG files per Audiveris invocation (default: 1)",
    )
    parser.add_argument(
        "--scale",
        type=float,
        default=3.0,
        help="Upscale factor for PNGs before OMR (default: 3)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        help="Process at most N pending PNG files (for testing)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run OMR even when .musicxml already exists",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List work without calling Audiveris",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print full Audiveris output on failure",
    )
    parser.add_argument(
        "--retry-failures",
        action="store_true",
        help=f"Re-run only files listed in {OMR_RESULTS_PATH.name}",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_dir = args.input.resolve()

    if not input_dir.is_dir():
        print(f"Input directory not found: {input_dir}", file=sys.stderr)
        return 1

    try:
        runner = resolve_audiveris(args.audiveris_bin)
    except FileNotFoundError as exc:
        if args.dry_run:
            runner = AudiverisRunner(["<audiveris-not-found>"], False)
        else:
            print(exc, file=sys.stderr)
            return 1

    tasks = discover_pngs(input_dir)
    if not tasks:
        print(f"No .png files found under {input_dir}", file=sys.stderr)
        return 1

    if args.retry_failures:
        try:
            retry_paths, previous_results = load_retry_failures()
        except FileNotFoundError as exc:
            print(exc, file=sys.stderr)
            return 1
        tasks_by_rel = {str(task.png.relative_to(input_dir)): task for task in tasks}
        missing = sorted(set(retry_paths) - set(tasks_by_rel))
        if missing:
            print(f"Retry list references missing files: {', '.join(missing)}", file=sys.stderr)
            return 1
        pending = [tasks_by_rel[path] for path in sorted(set(retry_paths))]
        args.force = True
        prior_ok = {
            row["file"]: row for row in previous_results.get("results", {}).get("ok", [])
        }
    else:
        prior_ok = {}
        pending = [task for task in tasks if needs_work(task, args.force)]
        if args.limit is not None:
            pending = pending[: max(0, args.limit)]

    print(f"Audiveris: {' '.join(runner.argv_prefix)}")
    print(f"Input: {input_dir}")
    print(f"Scale: {args.scale}x")
    if args.retry_failures:
        print(f"Retrying {len(pending)} failed file(s) from {OMR_RESULTS_PATH.name}")
    else:
        print(f"PNG files: {len(tasks)} ({len(pending)} to process)")

    if args.dry_run:
        for task in pending:
            print(f"  {task.png.relative_to(input_dir)}")
            print(f"    -> {task.musicxml.relative_to(input_dir)}")
            print(f"    omr cache: {task.omr.relative_to(ROOT)}")
        print(f"Skipped (up to date): {len(tasks) - len(pending)}")
        return 0

    ensure_tesseract_eng(runner)

    converted = skipped = failed = 0
    if args.retry_failures:
        skipped = len(tasks) - len(pending)
    else:
        skipped = len(tasks) - len([t for t in tasks if needs_work(t, args.force)])
    batch_size = max(1, args.batch_size)
    results: dict[str, list[dict[str, str]]] = {
        "ok": list(prior_ok.values()),
        "failed": [],
    }
    resolved_failures: set[str] = set()

    for index, start in enumerate(range(0, len(pending), batch_size), start=1):
        batch_pending = pending[start : start + batch_size]
        progress = f"[{start + len(batch_pending)}/{len(pending)}]"

        with tempfile.TemporaryDirectory(prefix="audiveris-") as tmp:
            work_dir = Path(tmp)
            prepared: list[Path] = []
            for task in batch_pending:
                if args.force and task.omr.is_file():
                    task.omr.unlink()
                prepared_path = prepare_png_for_omr(task.png, work_dir, args.scale)
                prepared.append(prepared_path)

            filesystems = sorted(
                {
                    input_dir.resolve(),
                    work_dir.resolve(),
                    *(task.png.parent.resolve() for task in batch_pending),
                }
            )
            result = run_audiveris_batch(
                runner,
                prepared,
                work_dir / "out",
                filesystems=filesystems,
            )
            if result.returncode != 0:
                reason = summarize_audiveris_output(result.stdout, result.stderr)
                for task in batch_pending:
                    failed += 1
                    rel = str(task.png.relative_to(input_dir))
                    log_path = write_audiveris_log(task.png.stem, result.stdout, result.stderr)
                    results["failed"].append(
                        {"file": rel, "reason": reason, "log": str(log_path.relative_to(ROOT))}
                    )
                    print(f"{progress} FAIL {rel}: {reason}", file=sys.stderr)
                    if args.verbose:
                        print(result.stdout + result.stderr, file=sys.stderr)
                continue

            for task in batch_pending:
                rel = str(task.png.relative_to(input_dir))
                try:
                    finalize_task(task, work_dir / "out")
                    converted += 1
                    results["ok"].append({"file": rel})
                    resolved_failures.add(rel)
                    print(f"{progress} OK {rel}")
                except Exception as exc:
                    failed += 1
                    results["failed"].append({"file": rel, "reason": str(exc)})
                    print(f"{progress} FAIL {rel}: {exc}", file=sys.stderr)

    if args.retry_failures:
        previous_failed = {
            row["file"]: row
            for row in previous_results.get("results", {}).get("failed", [])
        }
        for path, row in previous_failed.items():
            if path not in resolved_failures and path not in {
                item["file"] for item in results["failed"]
            }:
                results["failed"].append(row)
        results["ok"] = sorted(results["ok"], key=lambda row: row["file"])
        results["failed"] = sorted(results["failed"], key=lambda row: row["file"])

    OMR_RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OMR_RESULTS_PATH.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "input": str(input_dir),
                "converted": converted,
                "skipped": skipped,
                "failed": failed,
                "results": results,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(f"Done. {converted} converted, {skipped} skipped, {failed} failed.")
    print(f"OMR cache: {OMR_CACHE_DIR}")
    if failed:
        print(f"Failure details: {OMR_RESULTS_PATH}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
