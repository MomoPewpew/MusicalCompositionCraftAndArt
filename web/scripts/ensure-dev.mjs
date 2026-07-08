#!/usr/bin/env node
import { clearNextCacheIfStale } from "./clear-next-cache.mjs";

if (clearNextCacheIfStale()) {
  console.log("Clearing stale .next cache before dev server...");
}
