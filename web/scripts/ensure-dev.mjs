#!/usr/bin/env node
import { clearNextCacheIfStale } from "./clear-next-cache.mjs";

if (clearNextCacheIfStale()) {
  console.log("Clearing production .next cache before dev server...");
}
