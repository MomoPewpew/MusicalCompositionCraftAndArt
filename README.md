# Musical Composition Craft And Art — Downloads

Script to download the MIDI files and sheet-music PNGs from [Music Ed](https://textbook.realmusictheory.com/?book=Musical+Composition+Craft+And+Art) for educational use.

## Requirements

Python 3.9+ (stdlib only — no pip install needed).

## Usage

```bash
# Download everything (default book, into ./downloads/)
python3 download_book.py

# Preview what would be fetched
python3 download_book.py --dry-run

# Custom output folder
python3 download_book.py -o /path/to/output

# Re-download existing files
python3 download_book.py --force
```

## Output layout

```
downloads/
  Musical Composition Craft And Art.json
  Musical Composition Craft And Art/
    Chapter 1/
      Example 1/
        Section 1/
          Ex1-1-(1).mid
          Ex1-1-(1).png
        Section 2/
          ...
      Example 2/
        Ex1-2.mid
        Ex1-2.png
    Chapter 2/
      ...
    Extra/
      Example 1/
        Extra-1.mid
        ...
```

Examples with sub-parts get a `Section N` folder; single-part examples sit directly under `Example N`.

To reorganize an existing flat download:

```bash
python3 organize_examples.py          # apply
python3 organize_examples.py --dry-run  # preview
```

## How it works

The site loads a JSON manifest from S3 (`Musical Composition Craft And Art.json`) listing every chapter, example, and asset filename. This script reads that manifest and downloads each `.mid` and `.png` from the same S3 bucket the website uses.

---

## MIDI → MusicXML conversion

`convert_midi_to_musicxml.py` converts every downloaded `.mid` to MusicXML using [music21](https://web.mit.edu/music21/). Original MIDI files are not modified or removed.

### Setup (one time)

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### Usage

```bash
# Convert all MIDI under the default book folder
.venv/bin/python3 convert_midi_to_musicxml.py

# Preview
.venv/bin/python3 convert_midi_to_musicxml.py --dry-run

# Re-convert existing files
.venv/bin/python3 convert_midi_to_musicxml.py --force
```

### Output

MusicXML files are written next to each MIDI in the same example folder:

```
Chapter 1/
  Example 1/
    Section 1/
      Ex1-1-(1).mid
      Ex1-1-(1).musicxml
      Ex1-1-(1).png
```

**Note:** MIDI→MusicXML is an automated transcription. Layout, voicing, and notation details may differ from the textbook PNG scores. The MusicXML is best used for playback, analysis, or as a starting point in notation software — not as a pixel-perfect replacement for the sheet images.

---

## Example viewer website

Static Next.js site in [`web/`](web/) — browse all 149 examples with citations, sheet music images, mockup audio (when provided), and MIDI playback with tempo control.

### Data pipeline

```bash
# Extract figure citations from EPUB chapter splits
python3 scripts/extract_citations.py

# Build web manifest (downloads + citations + uncited overrides)
python3 scripts/build_examples_manifest.py
```

- [`data/uncited.json`](data/uncited.json) — Belkin original compositions (no textbook citation)
- [`data/citation_overrides.json`](data/citation_overrides.json) — manual citation fixes (e.g. multi-panel Figure 1.1)
- [`data/examples.json`](data/examples.json) — final manifest consumed by the website

### Mockup audio

Drop WAV/MP3 files in [`mockups/`](mockups/) named `{example-id}.wav` (e.g. `Ex5-2.wav`), or set explicit paths when building the manifest. Re-run `build_examples_manifest.py` and rebuild the site.

### Development

```bash
cd web
npm install
npm run dev
```

Opens at http://localhost:3001 (assets are copied automatically).

### Docker (local testing)

```bash
docker compose up --build
```

Opens at http://localhost:3001. The container mounts the repo for live reload and keeps `node_modules` in a named volume. On first start it builds `data/examples.json` automatically if missing.

### Production build

```bash
cd web
npm run build
```

Outputs static files to `web/out/`. GitHub Actions deploy workflow uploads `out/` via SFTP on push to `main`.
