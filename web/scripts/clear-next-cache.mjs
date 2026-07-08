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

function isBrokenNextCache() {
  if (!existsSync(nextDir)) return false;

  const hasServer = existsSync(join(nextDir, "server"));
  const hasRoutesManifest = existsSync(join(nextDir, "routes-manifest.json"));
  const hasBuildId = existsSync(join(nextDir, "BUILD_ID"));

  // Partial deletes (common on network filesystems) leave server/ without manifests.
  if (hasServer && !hasRoutesManifest) return true;
  if (hasServer && !hasBuildId) return true;

  return false;
}

function removeDir(path) {
  if (!existsSync(path)) return;

  // Prefer shell rm on network mounts; Node's recursive rm can fail with ENOTEMPTY.
  const shellResult = spawnSync("rm", ["-rf", path], { stdio: "inherit" });
  if (shellResult.status === 0 && !existsSync(path)) return;

  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    spawnSync("rm", ["-rf", path], { stdio: "inherit" });
  }
}

export function clearNextCacheIfStale({ always = false } = {}) {
  if (!existsSync(nextDir)) return false;

  const hasProductionCache = productionMarkers.some((name) =>
    existsSync(join(nextDir, name))
  );
  const broken = isBrokenNextCache();

  if (!always && !hasProductionCache && !broken) return false;

  removeDir(nextDir);
  return !existsSync(nextDir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (clearNextCacheIfStale({ always: process.argv.includes("--force") })) {
    console.log("Cleared .next cache");
  } else if (process.argv.includes("--force")) {
    console.warn("Could not fully clear .next cache; stop next dev and retry.");
    process.exit(1);
  }
}
