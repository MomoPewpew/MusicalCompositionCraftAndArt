#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = resolve(webRoot, ".next");
const exportMarker = resolve(nextDir, "export-marker.json");

// `next build` (static export) leaves artifacts that break `next dev` with missing chunk errors.
if (existsSync(exportMarker)) {
  console.log("Clearing production .next cache before dev server...");
  rmSync(nextDir, { recursive: true, force: true });
}
