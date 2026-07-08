export type ParsedYouTubeReference = {
  videoId: string;
  startSeconds: number;
  watchUrl: string;
  embedUrl: string;
};

function parseYouTubeStartTime(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);
  if (/^\d+s$/i.test(value)) return Number(value.slice(0, -1));

  const hours = value.match(/(\d+)h/i)?.[1];
  const minutes = value.match(/(\d+)m/i)?.[1];
  const seconds = value.match(/(\d+)s/i)?.[1];

  return (
    (hours ? Number(hours) * 3600 : 0) +
    (minutes ? Number(minutes) * 60 : 0) +
    (seconds ? Number(seconds) : 0)
  );
}

export function parseYouTubeReference(
  youtube: string,
  startSecondsOverride?: number
): ParsedYouTubeReference | null {
  const trimmed = youtube.trim();
  if (!trimmed) return null;

  if (/^[\w-]{11}$/.test(trimmed)) {
    const startSeconds = startSecondsOverride ?? 0;
    return {
      videoId: trimmed,
      startSeconds,
      watchUrl: buildYouTubeWatchUrl(trimmed, startSeconds),
      embedUrl: buildYouTubeEmbedUrl(trimmed, startSeconds)
    };
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    let videoId: string | null = null;

    if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (url.hostname.includes("youtube.com")) {
      videoId = url.searchParams.get("v");
      if (!videoId && url.pathname.startsWith("/embed/")) {
        videoId = url.pathname.split("/")[2] ?? null;
      }
    }

    if (!videoId) return null;

    const fromUrl = url.searchParams.get("t") ?? url.searchParams.get("start");
    const parsedFromUrl = fromUrl ? parseYouTubeStartTime(fromUrl) : 0;
    const startSeconds = startSecondsOverride ?? parsedFromUrl;

    return {
      videoId,
      startSeconds,
      watchUrl: buildYouTubeWatchUrl(videoId, startSeconds),
      embedUrl: buildYouTubeEmbedUrl(videoId, startSeconds)
    };
  } catch {
    return null;
  }
}

export function buildYouTubeWatchUrl(videoId: string, startSeconds = 0): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return startSeconds > 0 ? `${base}&t=${startSeconds}s` : base;
}

export function buildYouTubeEmbedUrl(videoId: string, startSeconds = 0): string {
  const params = new URLSearchParams({ rel: "0" });
  if (startSeconds > 0) params.set("start", String(startSeconds));
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
