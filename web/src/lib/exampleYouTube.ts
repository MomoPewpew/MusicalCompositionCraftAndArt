import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import generatedExampleYouTube from "@/generated/example-youtube.json";

export type ExampleYouTubeRecording = {
  youtube: string;
  startSeconds?: number | null;
  endSeconds?: number | null;
  label?: string;
  /** Public URL set by prepare-assets when youtube-archives/{id}.* exists */
  archiveAudio?: string | null;
};

export type ExampleYouTubeManifest = Record<string, ExampleYouTubeRecording>;

const generated = generatedExampleYouTube as ExampleYouTubeManifest;

function curatedManifestPath(): string | null {
  const candidates = [
    join(process.cwd(), "..", "data", "example-youtube.json"),
    join(process.cwd(), "data", "example-youtube.json")
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Load curated YouTube metadata.
 * Prefer the live repo file (`data/example-youtube.json`) so edits to
 * startSeconds/endSeconds apply on the next request during `next dev`
 * without re-running prepare-assets. Archive audio URLs still come from
 * the generated snapshot written by prepare-assets.
 */
export function getExampleYouTubeManifest(): ExampleYouTubeManifest {
  const curatedPath = curatedManifestPath();
  if (!curatedPath) return generated;

  const curated = JSON.parse(readFileSync(curatedPath, "utf8")) as ExampleYouTubeManifest;
  const merged: ExampleYouTubeManifest = {};
  for (const [exampleId, entry] of Object.entries(curated)) {
    merged[exampleId] = {
      ...entry,
      archiveAudio: generated[exampleId]?.archiveAudio ?? entry.archiveAudio ?? null
    };
  }
  return merged;
}

export function getExampleYouTube(exampleId: string): ExampleYouTubeRecording | null {
  const recording = getExampleYouTubeManifest()[exampleId];
  if (!recording?.youtube) return null;
  return recording;
}
