#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = resolve(webRoot, ".next");

// `next build` (static export) leaves artifacts that break `next dev` with missing chunk errors.
const productionMarkers = [
  "export-marker.json",
  "export-detail.json",
  "next-server.js.nft.json"
];

const hasProductionCache = productionMarkers.some((name) => existsSync(join(nextDir, name)));

if (hasProductionCache) {
  console.log("Clearing production .next cache before dev server...");
  rmSync(nextDir, { recursive: true, force: true });
}
