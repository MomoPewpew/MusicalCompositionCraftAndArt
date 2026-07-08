#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = resolve(webRoot, ".next");

// `next build` (static export) leaves a production `.next` tree that breaks `next dev`
// with missing vendor-chunk errors (e.g. next-themes.js).
const productionMarkers = [
  "export-marker.json",
  "export-detail.json",
  "next-server.js.nft.json"
];

function removeDir(path) {
  if (!existsSync(path)) return;
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    spawnSync("rm", ["-rf", path], { stdio: "inherit" });
  }
}

export function clearNextCacheIfStale({ always = false } = {}) {
  if (!existsSync(nextDir)) return false;

  const hasProductionCache = productionMarkers.some((name) =>
    existsSync(join(nextDir, name))
  );

  if (!always && !hasProductionCache) return false;

  removeDir(nextDir);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (clearNextCacheIfStale({ always: process.argv.includes("--force") })) {
    console.log("Cleared .next cache");
  }
}
