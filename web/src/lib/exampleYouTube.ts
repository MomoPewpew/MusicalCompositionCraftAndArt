import exampleYouTube from "@/generated/example-youtube.json";

export type ExampleYouTubeRecording = {
  youtube: string;
  startSeconds?: number;
  endSeconds?: number;
  label?: string;
  /** Public URL set by prepare-assets when youtube-archives/{id}.* exists */
  archiveAudio?: string | null;
};

export type ExampleYouTubeManifest = Record<string, ExampleYouTubeRecording>;

const manifest = exampleYouTube as ExampleYouTubeManifest;

export function getExampleYouTubeManifest(): ExampleYouTubeManifest {
  return manifest;
}

export function getExampleYouTube(exampleId: string): ExampleYouTubeRecording | null {
  const recording = manifest[exampleId];
  if (!recording?.youtube) return null;
  return recording;
}
