import Link from "next/link";

import { getChapters, getManifest } from "@/lib/examples";

export default function HomePage() {
  const manifest = getManifest();
  const chapters = getChapters();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {manifest.book}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          Browse musical examples from Alan Belkin&apos;s textbook with sheet music, source citations,
          mockup playback where available, and MIDI playback with tempo control.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {manifest.exampleCount} examples across {chapters.length} chapters.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Chapters
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {chapters.map((chapter) => (
            <Link
              key={chapter.slug}
              href={chapter.slug === "extra" ? "/extra/" : `/chapter/${chapter.number}/`}
              className={[
                "rounded-xl border border-black/10 bg-white/60 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
                "transition hover:border-black/15 hover:bg-white",
                "dark:border-white/10 dark:bg-zinc-950/30 dark:hover:border-white/15 dark:hover:bg-zinc-950/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
              ].join(" ")}
            >
              <div className="text-sm font-medium text-zinc-950 dark:text-zinc-100">{chapter.name}</div>
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {chapter.exampleCount} example{chapter.exampleCount === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
