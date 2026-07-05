#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const repoRoot = resolve(webRoot, "..");
const manifestPath = join(repoRoot, "data", "examples.json");
const downloadsDir = join(repoRoot, "downloads", "Musical Composition Craft And Art");
const humanizedDir = join(repoRoot, "downloads", "Musical Composition Craft And Art.humanized");
const publicAssetsDir = join(webRoot, "public", "assets");
const generatedDir = join(webRoot, "src", "generated");
const generatedManifestPath = join(generatedDir, "examples.json");
const generatedExerciseAssetsPath = join(generatedDir, "exercise-assets.json");
const exerciseAssetsManifestPath = join(repoRoot, "data", "exercise-assets.json");
const buildExerciseArchiveScript = join(repoRoot, "scripts", "build_exercise_archive.py");

function removeDir(path) {
  if (!existsSync(path)) return;
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    spawnSync("rm", ["-rf", path], { stdio: "inherit" });
  }
}

function copyFile(source, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(source, dest);
}

function toPublicPath(relativePath) {
  return `/assets/${relativePath.replace(/\\/g, "/")}`;
}

/** e.g. Chapter 1/Ex1-1.mid → Chapter 1/Ex1-1.humanized.mid */
function humanizedPublicRel(rel) {
  const dot = rel.lastIndexOf(".");
  if (dot === -1) return `${rel}.humanized`;
  return `${rel.slice(0, dot)}.humanized${rel.slice(dot)}`;
}

const SOUNDFONT_URL =
  "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-ogg.js";
const soundfontDir = join(webRoot, "public", "soundfonts", "FluidR3_GM");
const soundfontFile = join(soundfontDir, "acoustic_grand_piano-ogg.js");

async function ensureSoundfont() {
  mkdirSync(soundfontDir, { recursive: true });
  if (existsSync(soundfontFile)) {
    console.log("Soundfont already present:", relative(webRoot, soundfontFile));
    return;
  }
  console.log("Downloading piano soundfont...");
  const response = await fetch(SOUNDFONT_URL);
  if (!response.ok) {
    throw new Error(`Failed to download soundfont: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(soundfontFile, buffer);
  console.log(`Wrote ${relative(webRoot, soundfontFile)} (${buffer.length} bytes)`);
}

function copyExampleAssets(example) {
  let copied = 0;
  let missing = 0;
  const assets = {
    image: null,
    midi: null,
    midiHumanized: null,
    mockupAudio: null
  };

  for (const key of ["image", "midi"]) {
    const rel = example.assets[key];
    if (!rel) continue;
    const source = join(downloadsDir, rel);
    const dest = join(publicAssetsDir, rel);
    if (existsSync(source)) {
      copyFile(source, dest);
      assets[key] = toPublicPath(rel);
      copied += 1;
    } else {
      missing += 1;
      console.warn(`Missing ${key} for ${example.id}: ${rel}`);
    }
  }

  const midiRel = example.assets.midi;
  if (midiRel) {
    const humanizedSource = join(humanizedDir, midiRel);
    const humanizedPublic = humanizedPublicRel(midiRel);
    const humanizedDest = join(publicAssetsDir, humanizedPublic);
    if (existsSync(humanizedSource)) {
      copyFile(humanizedSource, humanizedDest);
      assets.midiHumanized = toPublicPath(humanizedPublic);
      copied += 1;
    }
  }

  const mockup = example.assets.mockupAudio;
  if (mockup) {
    const source = join(repoRoot, mockup);
    const basename = mockup.split("/").pop();
    const dest = join(publicAssetsDir, "mockups", basename);
    if (existsSync(source)) {
      copyFile(source, dest);
      assets.mockupAudio = toPublicPath(`mockups/${basename}`);
      copied += 1;
    } else {
      missing += 1;
      console.warn(`Missing mockup for ${example.id}: ${mockup}`);
    }
  }

  return { assets, copied, missing };
}

function buildExerciseArchive() {
  if (!existsSync(buildExerciseArchiveScript)) {
    console.warn("Exercise archive script not found; skipping.");
    return;
  }

  const python = process.env.PYTHON ?? "python3";
  const result = spawnSync(python, [buildExerciseArchiveScript], {
    cwd: repoRoot,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error("build_exercise_archive.py failed");
  }

  if (!existsSync(exerciseAssetsManifestPath)) {
    writeFileSync(
      generatedExerciseAssetsPath,
      `${JSON.stringify({ fileCount: 0, chapters: {} }, null, 2)}\n`,
      "utf8"
    );
    return;
  }

  const manifest = JSON.parse(readFileSync(exerciseAssetsManifestPath, "utf8"));
  for (const chapter of Object.values(manifest.chapters ?? {})) {
    if (chapter.archive) {
      chapter.archive = toPublicPath(chapter.archive.replace(/^assets\//, ""));
    }
  }
  writeFileSync(generatedExerciseAssetsPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (manifest.fileCount > 0) {
    const chapterCount = Object.keys(manifest.chapters ?? {}).length;
    console.log(`Exercise MusicXML: ${manifest.fileCount} files across ${chapterCount} chapter(s)`);
  }
}

async function main() {
  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    console.error("Run: python3 scripts/build_examples_manifest.py");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  removeDir(publicAssetsDir);
  mkdirSync(publicAssetsDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });

  let copied = 0;
  let missing = 0;
  let humanizedMidi = 0;

  const generatedExamples = manifest.examples.map((example) => {
    const { assets, copied: c, missing: m } = copyExampleAssets(example);
    copied += c;
    missing += m;
    if (assets.midiHumanized) humanizedMidi += 1;
    return { ...example, assets };
  });

  const generated = {
    ...manifest,
    examples: generatedExamples
  };

  writeFileSync(generatedManifestPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
  buildExerciseArchive();
  await ensureSoundfont();
  console.log(`Prepared assets: ${copied} copied, ${missing} missing`);
  if (humanizedMidi > 0) {
    console.log(`MIDI: ${humanizedMidi} with humanized variant (toggle in player)`);
  } else {
    console.log("MIDI: no humanized variants (run scripts/humanize_midi_assets.py to generate)");
  }
  console.log(`Wrote ${relative(webRoot, generatedManifestPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
