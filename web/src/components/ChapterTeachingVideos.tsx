import Link from "next/link";

import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import {
  chapterTeachingVideosHref,
  getChapterTeachingVideos
} from "@/lib/teachingVideos";
import { chapterHref, type ChapterEntry } from "@/lib/examples";

const cardClass = [
  "rounded-xl border border-black/10 bg-white/60 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
  "dark:border-white/10 dark:bg-zinc-950/30 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
].join(" ");

const glassCard = [
  "rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
  "dark:border-white/10 dark:bg-zinc-950/30 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
].join(" ");

const linkButtonClass = [
  "mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
  "border-zinc-300/60 bg-white/80 text-zinc-900 hover:bg-white",
  "dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
].join(" ");

export function TeachingVideosChapterLink({ chapter }: { chapter: ChapterEntry }) {
  const chapterVideos = getChapterTeachingVideos(chapter.number);
  if (!chapterVideos) return null;

  const videoLabel =
    chapterVideos.videos.length === 1
      ? "1 video"
      : `${chapterVideos.videos.length} videos`;

  return (
    <section className={cardClass}>
      <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-100">Teaching videos</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        YouTube lessons based on Belkin&apos;s writing ({videoLabel}).
      </p>
      <Link href={chapterTeachingVideosHref(chapter.number!)} className={linkButtonClass}>
        View teaching videos
      </Link>
    </section>
  );
}

export function ChapterTeachingVideosPageView({ chapter }: { chapter: ChapterEntry }) {
  const chapterVideos = getChapterTeachingVideos(chapter.number);
  if (!chapterVideos) return null;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href={chapterHref(chapter)}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to {chapter.name}
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {chapter.name} — Teaching videos
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            YouTube lessons from Alan Belkin himself, or lessons based on his writing.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {chapterVideos.videos.map((video, index) => (
          <section key={`${video.title}-${index}`} className={glassCard}>
            <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-100">{video.title}</h2>
            {video.description ? (
              <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {video.description}
              </p>
            ) : null}
            <div className={video.description ? "mt-5" : "mt-4"}>
              <YouTubeEmbed
                youtube={video.youtube}
                startSeconds={video.startSeconds}
                kind={video.kind}
                title={`${chapter.name} — ${video.title}`}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
