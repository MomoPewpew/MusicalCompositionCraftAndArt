import Link from "next/link";

import { getChapterExerciseAssets } from "@/lib/exerciseAssets";
import { chapterHref, type ChapterEntry } from "@/lib/examples";

const cardClass = [
  "rounded-xl border border-black/10 bg-white/60 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
  "dark:border-white/10 dark:bg-zinc-950/30 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
].join(" ");

const glassCard = [
  "rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
  "dark:border-white/10 dark:bg-zinc-950/30 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
].join(" ");

export function ExerciseChapterLink({ chapter }: { chapter: ChapterEntry }) {
  const assets = getChapterExerciseAssets(chapter.number);
  if (!assets) return null;

  const fileLabel =
    assets.fileCount === 1 ? "1 MusicXML file" : `${assets.fileCount} MusicXML files`;

  return (
    <section className={cardClass}>
      <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-100">Exercises</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        Handmade MusicXML scores for this chapter&apos;s exercises ({fileLabel}).
      </p>
      <Link
        href={`/chapter/${chapter.number}/exercises/`}
        className={[
          "mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
          "border-zinc-300/60 bg-white/80 text-zinc-900 hover:bg-white",
          "dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
        ].join(" ")}
      >
        View exercise scores
      </Link>
    </section>
  );
}

export function ChapterExercisesPageView({ chapter }: { chapter: ChapterEntry }) {
  const assets = getChapterExerciseAssets(chapter.number);
  if (!assets) return null;

  const fileLabel =
    assets.fileCount === 1 ? "1 MusicXML file" : `${assets.fileCount} MusicXML files`;

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
            {chapter.name} — Exercises
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Handmade MusicXML versions of the chapter exercise material.
          </p>
        </div>
      </div>

      <section className={glassCard}>
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Download
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          All exercise scores for this chapter ({fileLabel}) in one ZIP archive.
        </p>
        <a
          href={assets.archive}
          download
          className={[
            "mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
            "border-zinc-300/60 bg-white/80 text-zinc-900 hover:bg-white",
            "dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-900",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
          ].join(" ")}
        >
          Download exercise MusicXML (ZIP)
        </a>
      </section>

      <section className={glassCard}>
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Files in this archive
        </h2>
        <ul className="space-y-2">
          {assets.files.map((file) => (
            <li
              key={file}
              className="rounded-lg border border-black/5 bg-white/50 px-3 py-2 font-mono text-sm text-zinc-800 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-200"
            >
              {file}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
