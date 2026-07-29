# Musical Composition Craft And Art

Educational viewer for [Alan Belkin](https://alanbelkinmusic.com/)’s textbook *Musical Composition: Craft and Art*, with sheet music images, figure citations, and in-browser playback.

The repo also contains Python tooling to download the original assets from [Real Music Theory](https://textbook.realmusictheory.com/?book=Musical+Composition+Craft+And+Art), build a web manifest from the EPUB citations, correct MIDI tempi, optionally humanize dynamics, and archive clipped YouTube audio for attributed repertoire.

**149 examples** across 20 chapters plus an Extra section.

## Quick start (website)

```bash
# 1. Data manifest (requires downloads/ and data/citations.json)
python3 scripts/build_examples_manifest.py

# 2. Run the site
cd web
npm install
npm run dev
```

Opens at http://localhost:3001

## Project layout

```
├── data/                  # Citations, manifest, overrides
│   ├── citations.json     # Figure captions + prose (from EPUB)
│   ├── examples.json      # Web manifest (generated)
│   ├── example-youtube.json  # Curated YouTube recordings per example
│   ├── citation_overrides.json
│   ├── tempo_overrides.json
│   └── uncited.json
├── downloads/
│   └── Musical Composition Craft And Art/   # Canonical MIDI + PNG assets
│   └── Musical Composition Craft And Art.humanized/  # Humanized MIDI (shipped)
├── mockups/               # Optional WAV/MP3 mockup audio per example
├── youtube-archives/      # Clipped YouTube audio (shipped; from yt-dlp)
├── scripts/               # Manifest, tempo, humanization, YouTube archive pipeline
├── web/                   # Next.js 15 static export site
└── download_book.py       # Fetch assets from Real Music Theory S3
```

---

## Example viewer (`web/`)

Static Next.js site — browse chapters and examples with:

- **Citations** — attributed composer/work captions from the textbook, with fallbacks for Belkin originals and exercises
- **Sheet music** — PNG scores from the textbook
- **Playback tabs** — switch between available styles (unavailable tabs stay visible but disabled):
  - **YouTube** — curated embed of a popular recording, clipped with `start` / `end` when set
  - **YouTube archive** — committed audio clip of that same excerpt (fallback if the video is removed, embedding is disabled, or blocked in your country)
  - **Mockup** — WAV/MP3 when provided in `mockups/`
  - **MIDI** — FluidR3 grand piano soundfont in the browser, with:
    - Volume slider (0–200%, synced across players on a page)
    - Tempo slider (50–150%, remembered per example)
    - **Humanize dynamics** toggle (on by default) — switches between original and [midihum](https://github.com/erwald/midihum)-processed MIDI

### Development

```bash
cd web
npm install
npm run dev
```

`prepare-assets.mjs` runs automatically: copies MIDI/PNG from `downloads/` (and humanized variants when present), mockups, and YouTube archive audio into `web/public/assets/`, downloads the piano soundfont if needed, and writes generated JSON under `web/src/generated/` (including `examples.json` and `example-youtube.json`).

### Production build

```bash
cd web
npm run build
```

Outputs static files to `web/out/`. Pushes to `main` trigger a GitHub Actions workflow that rebuilds the manifest and deploys `out/` via SFTP.

### Docker

```bash
docker compose up --build
```

Opens at http://localhost:3001. Mounts the repo for live reload; builds `data/examples.json` on first start if missing.

---

## Data pipeline

```bash
# Extract figure citations from EPUB chapter splits (one-time / when EPUB changes)
python3 scripts/extract_citations.py

# Build web manifest
python3 scripts/build_examples_manifest.py
```

| File | Purpose |
|------|---------|
| `data/citations.json` | Figure captions and surrounding prose from the EPUB |
| `data/uncited.json` | Belkin original compositions with no textbook citation |
| `data/citation_overrides.json` | Manual citation fixes (e.g. multi-panel figures) |
| `data/tempo_overrides.json` | Manual BPM overrides for tempo correction |
| `data/example-youtube.json` | Curated YouTube recordings (URL, optional start/end, label) per example id |
| `data/examples.json` | Final manifest consumed by the website |

### Mockup audio

Drop files in `mockups/` named `{example-id}.wav` / `.mp3` (e.g. `Ex5-2.wav`), then re-run `build_examples_manifest.py` and rebuild the site.

### YouTube recordings and archives

Attributed examples can link a real-world recording in `data/example-youtube.json`:

```json
{
  "Ex3-4": {
    "youtube": "https://www.youtube.com/watch?v=VIDEO_ID",
    "startSeconds": 0,
    "endSeconds": 58,
    "label": "Kaufmann — Walther’s Prize Song"
  }
}
```

- Key by example id (`Ex3-4`, `Ex1-1-(1)`, …).
- `startSeconds` / `endSeconds` are absolute times in the source video (YouTube embed `start` / `end`).
- The site shows the embed on the **YouTube** tab when an entry exists.

To ship a durable audio fallback, download the clipped excerpt **on your machine** (requires [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) and `ffmpeg`; **not** run in GitHub Actions):

```bash
python3 scripts/download_youtube_archives.py
python3 scripts/download_youtube_archives.py --example Ex3-4
python3 scripts/download_youtube_archives.py --force   # re-download
```

Writes `youtube-archives/{example-id}.mp3`. `startSeconds` defaults to `0`; omit `endSeconds` to archive through the end of the video. Commit the MP3s; deploy copies them like mockups. The **YouTube archive** tab unlocks when that file is present.

---

## MIDI processing

Original MIDI files in `downloads/` are the canonical source. Processing scripts write to separate locations and never overwrite without an explicit `--apply` flag (tempo) or a separate output directory (humanization).

### Tempo correction

Some source MIDIs have incorrect default tempi (often 108 or 140 BPM). `scripts/fix_midi_tempos.py` infers better values from citation movement names (Allemande, Menuetto, Prelude, …), textbook prose hints, and defaults for Belkin originals.

```bash
python3 scripts/fix_midi_tempos.py              # dry-run
python3 scripts/fix_midi_tempos.py --apply      # write changes (backs up to .midbak/ first)
```

Manual overrides: `data/tempo_overrides.json`

### Humanization

Uses [midihum](https://github.com/erwald/midihum) (ML velocity humanization, trained on competition piano performances). Generates a parallel tree of humanized files:

```
downloads/Musical Composition Craft And Art.humanized/
  Chapter 7/Example 1/Ex7-1.mid   # same paths as originals
```

At build time these are published as `Ex7-1.humanized.mid` alongside `Ex7-1.mid`. The humanized files are **committed to the repo** (~430 KB total) so deploy does not need midihum installed.

```bash
# Requires a local midihum checkout (set MIDIHUM_DIR if not in the default location)
python3 scripts/humanize_midi_assets.py
# or: cd web && npm run humanize-midi

python3 scripts/humanize_midi_assets.py --force   # regenerate all
```

After regenerating, commit the updated `.humanized/` directory.

A small patch (`scripts/patches/midihum-short-excerpts.patch`) is applied automatically so midihum handles short textbook excerpts.

---

## Downloading assets

Fetch MIDI and PNG files from the Real Music Theory S3 bucket (stdlib only — no pip install):

```bash
python3 download_book.py              # into ./downloads/
python3 download_book.py --dry-run    # preview
python3 download_book.py --force      # re-download existing files
```

To reorganize a flat download into the chapter/example folder structure:

```bash
python3 organize_examples.py
python3 organize_examples.py --dry-run
```

### Output layout

```
downloads/
  Musical Composition Craft And Art.json
  Musical Composition Craft And Art/
    Chapter 1/
      Example 1/
        Section 1/
          Ex1-1-(1).mid
          Ex1-1-(1).png
      Example 2/
        Ex1-2.mid
        Ex1-2.png
    Extra/
      Example 1/
        Extra-1.mid
        ...
```

---

## Score images from EPUB

The PNGs bundled with the Real Music Theory download are fairly small (~650px wide). Higher-resolution versions are embedded in the textbook EPUB.

[`scripts/extract_score_images.py`](scripts/extract_score_images.py) maps each example to its textbook figure (via `figureRef` in `data/examples.json`), extracts the image from the EPUB, and writes it into `downloads/`:

```bash
# Default EPUB path (override with --epub or EPUB_PATH)
.venv/bin/python scripts/extract_score_images.py --dry-run
.venv/bin/python scripts/extract_score_images.py --force
```

- **1:1 figures** (most examples): full EPUB image copied (typically **900px** wide)
- **Multi-section figures** (e.g. Figure 1.1 → four motives): composite image cropped into horizontal bands
- Previous e7mac PNGs backed up as `*.e7mac.png` (gitignored) unless `--no-backup`
- **Extra** examples are not in the EPUB figure list; they keep the original download PNGs

Default EPUB: `Musical Composition/Belkin, Alan - Musical composition_ craft and art (2018, Yale University Press) - libgen.li.epub`

The PDF contains the same bitmaps; the EPUB is preferred because figure captions and image paths are structured in HTML.

After refreshing PNGs, rebuild web assets: `cd web && npm run build`

---

## Score → MusicXML (optional)

MusicXML files are **not used by the website today** but are generated for possible future use (interactive notation, diffing against MIDI, etc.).

### Recommended: Audiveris OMR (from PNG)

[`scripts/convert_png_to_musicxml.py`](scripts/convert_png_to_musicxml.py) runs [Audiveris](https://github.com/Audiveris/audiveris) on the textbook PNG scores. This follows the printed layout much better than MIDI conversion.

**Install Audiveris** (includes its own JRE):

```bash
# Linux (Flatpak — tested)
flatpak install flathub org.audiveris.audiveris

# Or Ubuntu .deb from https://github.com/Audiveris/audiveris/releases
# sudo apt install ./Audiveris-*-ubuntu24.04-x86_64.deb
```

The script auto-detects Flatpak, downloads legacy `eng.traineddata` on first run, and upscales PNGs when needed for OMR (2× for EPUB-sized images, 3× for legacy low-res PNGs).

Recommended order:

```bash
.venv/bin/python scripts/extract_score_images.py --force
.venv/bin/python scripts/convert_png_to_musicxml.py --limit 5
```

Optional: `export AUDIVERIS_BIN=/opt/audiveris/bin/Audiveris` to override auto-detection.

Output:

- `Ex7-1.musicxml` next to each PNG (extracted from Audiveris `.mxl`)
- `data/omr-cache/…/Ex7-1.omr` — Audiveris project files (gitignored; open in GUI to fix recognition)

OMR is slow (~10–60s per image) and dense scores may need manual correction in the Audiveris GUI. Quality still usually beats MIDI import for matching the PNG.

### Legacy: music21 MIDI import

[`convert_midi_to_musicxml.py`](convert_midi_to_musicxml.py) converts MIDI via [music21](https://web.mit.edu/music21/). Fast but lossy — voicing, stems, and layout rarely match the textbook images.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python3 convert_midi_to_musicxml.py
```

---

## Python setup

| Task | Requirements |
|------|----------------|
| Download, organize, manifest | Python 3.9+, stdlib |
| Tempo fix, MIDI→MusicXML (legacy) | `pip install -r requirements.txt` (music21) |
| PNG extraction (EPUB) | Pillow |
| PNG→MusicXML (Audiveris OMR) | [Audiveris](https://github.com/Audiveris/audiveris) install + `AUDIVERIS_BIN` |
| Humanization | Separate [midihum](https://github.com/erwald/midihum) checkout with its own venv |
| YouTube archives (local only) | [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) + `ffmpeg` on PATH |

---

## License

See [LICENSE](LICENSE). Textbook content and musical examples © Alan Belkin and respective composers. This project is an independent educational viewer; assets are used under the terms provided by Real Music Theory / the textbook publisher.
