export type YouTubeEmbedKind = "video" | "playlist";

export type ParsedYouTubeReference = {
  kind: YouTubeEmbedKind;
  videoId: string | null;
  playlistId: string | null;
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

function resolveYouTubeKind(
  videoId: string | null,
  playlistId: string | null,
  kindOverride?: YouTubeEmbedKind
): YouTubeEmbedKind | null {
  if (kindOverride === "playlist") {
    return playlistId ? "playlist" : null;
  }
  if (kindOverride === "video") {
    return videoId ? "video" : null;
  }
  if (videoId) return "video";
  if (playlistId) return "playlist";
  return null;
}

export function buildYouTubeWatchUrl(
  kind: YouTubeEmbedKind,
  videoId: string | null,
  playlistId: string | null,
  startSeconds = 0
): string {
  if (kind === "playlist" && playlistId) {
    return `https://www.youtube.com/playlist?list=${playlistId}`;
  }
  if (!videoId) return "";
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  const params = new URLSearchParams();
  if (playlistId) params.set("list", playlistId);
  if (startSeconds > 0) params.set("t", `${startSeconds}s`);
  const query = params.toString();
  return query ? `${base}&${query}` : base;
}

export function buildYouTubeEmbedUrl(
  kind: YouTubeEmbedKind,
  videoId: string | null,
  playlistId: string | null,
  startSeconds = 0
): string {
  if (kind === "playlist" && playlistId) {
    const params = new URLSearchParams({ list: playlistId, rel: "0" });
    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  }
  if (!videoId) return "";
  const params = new URLSearchParams({ rel: "0" });
  if (playlistId) params.set("list", playlistId);
  if (startSeconds > 0) params.set("start", String(startSeconds));
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function parseYouTubeReference(
  youtube: string,
  options: { startSeconds?: number; kind?: YouTubeEmbedKind } = {}
): ParsedYouTubeReference | null {
  const trimmed = youtube.trim();
  if (!trimmed) return null;

  const { startSeconds: startSecondsOverride, kind: kindOverride } = options;

  if (/^[\w-]{11}$/.test(trimmed)) {
    const startSeconds = startSecondsOverride ?? 0;
    const kind = kindOverride ?? "video";
    return {
      kind,
      videoId: trimmed,
      playlistId: null,
      startSeconds,
      watchUrl: buildYouTubeWatchUrl("video", trimmed, null, startSeconds),
      embedUrl: buildYouTubeEmbedUrl("video", trimmed, null, startSeconds)
    };
  }

  if (/^PL[\w-]+$/.test(trimmed)) {
    const kind = "playlist";
    return {
      kind,
      videoId: null,
      playlistId: trimmed,
      startSeconds: 0,
      watchUrl: buildYouTubeWatchUrl(kind, null, trimmed),
      embedUrl: buildYouTubeEmbedUrl(kind, null, trimmed)
    };
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    let videoId: string | null = null;
    let playlistId: string | null = null;

    if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/playlist")) {
        playlistId = url.searchParams.get("list");
      } else {
        videoId = url.searchParams.get("v");
        playlistId = url.searchParams.get("list");
        if (!videoId && url.pathname.startsWith("/embed/")) {
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts[1] === "videoseries") {
            playlistId = url.searchParams.get("list") ?? playlistId;
          } else {
            videoId = parts[1] ?? null;
            playlistId = url.searchParams.get("list") ?? playlistId;
          }
        }
      }
    }

    const kind = resolveYouTubeKind(videoId, playlistId, kindOverride);
    if (!kind) return null;

    const fromUrl = url.searchParams.get("t") ?? url.searchParams.get("start");
    const parsedFromUrl = fromUrl ? parseYouTubeStartTime(fromUrl) : 0;
    const startSeconds = startSecondsOverride ?? parsedFromUrl;

    return {
      kind,
      videoId,
      playlistId,
      startSeconds,
      watchUrl: buildYouTubeWatchUrl(kind, videoId, playlistId, startSeconds),
      embedUrl: buildYouTubeEmbedUrl(kind, videoId, playlistId, startSeconds)
    };
  } catch {
    return null;
  }
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
