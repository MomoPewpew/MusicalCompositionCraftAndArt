import Link from "next/link";

import { MobileChapterNav } from "@/components/MobileChapterNav";
import { chapterHref, getChapters, getGroupedExamplesForChapter, getManifest } from "@/lib/examples";

export default function HomePage() {
  const manifest = getManifest();
  const chapters = getChapters();
  const firstChapter = chapters.find((chapter) => chapter.number === 1) ?? chapters[0];
  const firstExamples = firstChapter ? getGroupedExamplesForChapter(firstChapter) : [];

  return (
    <div className="space-y-10">
      <MobileChapterNav />

      <section className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {manifest.book}
        </h1>
        <p className="max-w-3xl text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          Browse musical examples from Alan Belkin&apos;s textbook with sheet music, source citations,
          mockup playback where available, and MIDI playback with tempo control.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {manifest.exampleCount} examples across {chapters.length} chapters. Use the chapter
          navigation to browse examples.
        </p>
      </section>

      {firstChapter && (
        <section className="space-y-4 lg:hidden">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
            Start with {firstChapter.name}
          </h2>
          <ul className="space-y-2">
            {firstExamples.slice(0, 6).map((example) => (
              <li key={example.exampleNum}>
                <Link
                  href={example.href}
                  className="text-sm font-medium text-zinc-900 underline decoration-black/20 underline-offset-4 hover:decoration-black/40 dark:text-zinc-100 dark:decoration-white/20 dark:hover:decoration-white/40"
                >
                  {example.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={chapterHref(firstChapter)}
            className="inline-flex text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            View all examples in {firstChapter.name} →
          </Link>
        </section>
      )}
    </div>
  );
}
