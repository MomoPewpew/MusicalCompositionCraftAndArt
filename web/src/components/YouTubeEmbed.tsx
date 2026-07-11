import { formatTimestamp, parseYouTubeReference, type YouTubeEmbedKind } from "@/lib/youtube";

type YouTubeEmbedProps = {
  youtube: string;
  startSeconds?: number;
  kind?: YouTubeEmbedKind;
  title: string;
};

export function YouTubeEmbed({ youtube, startSeconds, kind, title }: YouTubeEmbedProps) {
  const parsed = parseYouTubeReference(youtube, { startSeconds, kind });
  if (!parsed) {
    return (
      <p className="text-sm text-red-700 dark:text-red-300">
        Could not parse YouTube link: {youtube}
      </p>
    );
  }

  const linkLabel = parsed.kind === "playlist" ? "Open playlist on YouTube" : "Open on YouTube";

  return (
    <div className="space-y-3">
      <div className="aspect-video overflow-hidden rounded-xl border border-black/10 bg-black shadow-[0_0_0_1px_rgba(0,0,0,0.03)] dark:border-white/10">
        <iframe
          src={parsed.embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        <a
          href={parsed.watchUrl}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40 dark:decoration-white/20 dark:hover:decoration-white/40"
        >
          {linkLabel}
        </a>
        {parsed.kind === "video" && parsed.startSeconds > 0 ? (
          <span> · starts at {formatTimestamp(parsed.startSeconds)}</span>
        ) : null}
      </p>
    </div>
  );
}
