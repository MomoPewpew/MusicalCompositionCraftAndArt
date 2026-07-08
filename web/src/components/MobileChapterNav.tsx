"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  chapterHref,
  getChapters,
  getGroupedExamplesForChapter,
  isExamplePathActive,
  parseActiveChapterFromPath
} from "@/lib/examples";
import {
  chapterExercisesHref,
  chapterHasExercises,
  isChapterExercisesPathActive
} from "@/lib/exerciseAssets";
import {
  chapterInfographicHref,
  chapterHasInfographic,
  isChapterInfographicPathActive
} from "@/lib/infographics";
import {
  chapterStudyGroupHref,
  chapterHasStudyGroupSessions,
  isChapterStudyGroupPathActive
} from "@/lib/studyGroupSessions";

export function MobileChapterNav() {
  const pathname = usePathname();
  const activeChapterSlug = parseActiveChapterFromPath(pathname);
  const chapters = getChapters();
  const activeChapter =
    chapters.find((chapter) => chapter.slug === activeChapterSlug) ??
    chapters.find((chapter) => chapter.number === 1);

  if (!activeChapter) {
    return null;
  }

  const grouped = getGroupedExamplesForChapter(activeChapter);

  return (
    <div className="space-y-3 lg:hidden">
      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        Chapter
      </label>
      <select
        className="w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-zinc-900 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100"
        value={activeChapter.slug}
        onChange={(event) => {
          const chapter = chapters.find((item) => item.slug === event.target.value);
          if (chapter) {
            window.location.href = chapterHref(chapter);
          }
        }}
      >
        {chapters.map((chapter) => (
          <option key={chapter.slug} value={chapter.slug}>
            {chapter.name}
          </option>
        ))}
      </select>

      <label className="block text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        Example
      </label>
      <div className="flex flex-wrap gap-2">
        {grouped.map((example) => (
          <Link
            key={example.exampleNum}
            href={example.href}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium",
              isExamplePathActive(pathname, example.href)
                ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-zinc-950 dark:text-zinc-50"
                : "border-black/10 bg-white/60 text-zinc-700 dark:border-white/10 dark:bg-zinc-950/30 dark:text-zinc-300"
            ].join(" ")}
          >
            {example.label}
          </Link>
        ))}
        {activeChapter.number != null && chapterHasInfographic(activeChapter.number) ? (
          <Link
            href={chapterInfographicHref(activeChapter.number)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium",
              isChapterInfographicPathActive(pathname, activeChapter.number)
                ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-zinc-950 dark:text-zinc-50"
                : "border-black/10 bg-white/60 text-zinc-700 dark:border-white/10 dark:bg-zinc-950/30 dark:text-zinc-300"
            ].join(" ")}
          >
            Infographic
          </Link>
        ) : null}
        {activeChapter.number != null && chapterHasStudyGroupSessions(activeChapter.number) ? (
          <Link
            href={chapterStudyGroupHref(activeChapter.number)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium",
              isChapterStudyGroupPathActive(pathname, activeChapter.number)
                ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-zinc-950 dark:text-zinc-50"
                : "border-black/10 bg-white/60 text-zinc-700 dark:border-white/10 dark:bg-zinc-950/30 dark:text-zinc-300"
            ].join(" ")}
          >
            Study group
          </Link>
        ) : null}
        {activeChapter.number != null && chapterHasExercises(activeChapter.number) ? (
          <Link
            href={chapterExercisesHref(activeChapter.number)}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium",
              isChapterExercisesPathActive(pathname, activeChapter.number)
                ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-zinc-950 dark:text-zinc-50"
                : "border-black/10 bg-white/60 text-zinc-700 dark:border-white/10 dark:bg-zinc-950/30 dark:text-zinc-300"
            ].join(" ")}
          >
            Exercises
          </Link>
        ) : null}
      </div>
    </div>
  );
}
