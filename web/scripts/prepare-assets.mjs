#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const repoRoot = resolve(webRoot, "..");
const manifestPath = join(repoRoot, "data", "examples.json");
const downloadsDir = join(repoRoot, "downloads", "Musical Composition Craft And Art");
const publicAssetsDir = join(webRoot, "public", "assets");
const generatedDir = join(webRoot, "src", "generated");
const generatedManifestPath = join(generatedDir, "examples.json");

function copyFile(source, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(source, dest);
}

function toPublicPath(relativePath) {
  return `/assets/${relativePath.replace(/\\/g, "/")}`;
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

async function main() {
  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    console.error("Run: python3 scripts/build_examples_manifest.py");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  rmSync(publicAssetsDir, { recursive: true, force: true });
  mkdirSync(publicAssetsDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });

  let copied = 0;
  let missing = 0;

  for (const example of manifest.examples) {
    const rewritten = {
      ...example,
      assets: { ...example.assets }
    };

    for (const key of ["image", "midi"]) {
      const rel = example.assets[key];
      if (!rel) {
        rewritten.assets[key] = null;
        continue;
      }
      const source = join(downloadsDir, rel);
      const dest = join(publicAssetsDir, rel);
      if (existsSync(source)) {
        copyFile(source, dest);
        rewritten.assets[key] = toPublicPath(rel);
        copied += 1;
      } else {
        rewritten.assets[key] = null;
        missing += 1;
        console.warn(`Missing ${key} for ${example.id}: ${rel}`);
      }
    }

    const mockup = example.assets.mockupAudio;
    if (mockup) {
      const source = join(repoRoot, mockup);
      const basename = mockup.split("/").pop();
      const dest = join(publicAssetsDir, "mockups", basename);
      if (existsSync(source)) {
        copyFile(source, dest);
        rewritten.assets.mockupAudio = toPublicPath(`mockups/${basename}`);
        copied += 1;
      } else {
        rewritten.assets.mockupAudio = null;
        missing += 1;
        console.warn(`Missing mockup for ${example.id}: ${mockup}`);
      }
    }
  }

  const generated = {
    ...manifest,
    examples: manifest.examples.map((example) => {
      const rewritten = { ...example, assets: { ...example.assets } };
      for (const key of ["image", "midi"]) {
        const rel = example.assets[key];
        rewritten.assets[key] = rel ? toPublicPath(rel) : null;
      }
      if (example.assets.mockupAudio) {
        const basename = example.assets.mockupAudio.split("/").pop();
        const source = join(repoRoot, example.assets.mockupAudio);
        rewritten.assets.mockupAudio = existsSync(source)
          ? toPublicPath(`mockups/${basename}`)
          : null;
      } else {
        rewritten.assets.mockupAudio = null;
      }
      return rewritten;
    })
  };

  writeFileSync(generatedManifestPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
  await ensureSoundfont();
  console.log(`Prepared assets: ${copied} copied, ${missing} missing`);
  console.log(`Wrote ${relative(webRoot, generatedManifestPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
