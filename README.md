# Musical Composition Craft And Art

Educational viewer for [Alan Belkin](https://alanbelkinmusic.com/)’s textbook *Musical Composition: Craft and Art*, with sheet music images, figure citations, and in-browser playback.

The repo also contains Python tooling to download the original assets from [Real Music Theory](https://textbook.realmusictheory.com/?book=Musical+Composition+Craft+And+Art), build a web manifest from the EPUB citations, correct MIDI tempi, and optionally humanize dynamics.

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
│   ├── citation_overrides.json
│   ├── tempo_overrides.json
│   └── uncited.json
├── downloads/
│   └── Musical Composition Craft And Art/   # Canonical MIDI + PNG assets
│   └── Musical Composition Craft And Art.humanized/  # Humanized MIDI (shipped)
├── mockups/               # Optional WAV/MP3 mockup audio per example
├── scripts/               # Manifest, tempo, humanization pipeline
├── web/                   # Next.js 15 static export site
└── download_book.py       # Fetch assets from Real Music Theory S3
```

---

## Example viewer (`web/`)

Static Next.js site — browse chapters and examples with:

- **Citations** — attributed composer/work captions from the textbook, with fallbacks for Belkin originals and exercises
- **Sheet music** — PNG scores from the textbook
- **Mockup audio** — WAV/MP3 when provided in `mockups/`
- **MIDI playback** — FluidR3 grand piano soundfont in the browser, with:
  - Volume slider (0–200%, synced across players on a page)
  - Tempo slider (50–150%, remembered per example)
  - **Humanize dynamics** toggle (on by default) — switches between original and [midihum](https://github.com/erwald/midihum)-processed MIDI

### Development

```bash
cd web
npm install
npm run dev
```

`prepare-assets.mjs` runs automatically: copies MIDI/PNG from `downloads/` (and humanized variants when present) into `web/public/assets/`, downloads the piano soundfont if needed, and writes `web/src/generated/examples.json`.

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
| `data/examples.json` | Final manifest consumed by the website |

### Mockup audio

Drop files in `mockups/` named `{example-id}.wav` (e.g. `Ex5-2.wav`), then re-run `build_examples_manifest.py` and rebuild the site.

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

## MIDI → MusicXML (optional)

`convert_midi_to_musicxml.py` converts downloaded `.mid` files to MusicXML using [music21](https://web.mit.edu/music21/). Originals are not modified.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python3 convert_midi_to_musicxml.py
```

MusicXML is written next to each MIDI in the same folder. Automated transcription — useful for analysis or as a starting point in notation software, not a replacement for the PNG scores.

---

## Python setup

| Task | Requirements |
|------|----------------|
| Download, organize, manifest | Python 3.9+, stdlib |
| Tempo fix, MusicXML | `pip install -r requirements.txt` (music21) |
| Humanization | Separate [midihum](https://github.com/erwald/midihum) checkout with its own venv |

---

## License

See [LICENSE](LICENSE). Textbook content and musical examples © Alan Belkin and respective composers. This project is an independent educational viewer; assets are used under the terms provided by Real Music Theory / the textbook publisher.
