"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getChapterLandingTitle } from "@/lib/chapterTitles";
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

const navLinkClass = [
  "block rounded-lg px-2 py-1.5 text-sm transition",
  "text-zinc-700 hover:bg-black/5 hover:text-zinc-950",
  "dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
].join(" ");

const activeNavLinkClass = [
  "block rounded-lg px-2 py-1.5 text-sm font-medium",
  "bg-black/5 text-zinc-950",
  "dark:bg-white/10 dark:text-zinc-50"
].join(" ");

export function BookSidebar() {
  const pathname = usePathname();
  const activeChapterSlug = parseActiveChapterFromPath(pathname);
  const chapters = getChapters();

  return (
    <nav
      aria-label="Chapters and examples"
      className={[
        "sticky top-[4.75rem] hidden h-[calc(100dvh-4.75rem)] w-64 shrink-0 overflow-y-auto pb-8 lg:block",
        "border-r border-black/10 pr-4 dark:border-white/10"
      ].join(" ")}
    >
      <div className="space-y-2">
        {chapters.map((chapter) => {
          const isActiveChapter = activeChapterSlug === chapter.slug;
          const isDefaultOpen = activeChapterSlug === null && chapter.number === 1;
          const grouped = getGroupedExamplesForChapter(chapter);

          return (
            <details
              key={chapter.slug}
              open={isActiveChapter || isDefaultOpen}
              className="group rounded-xl border border-transparent open:border-black/5 open:bg-white/40 open:dark:border-white/10 open:dark:bg-zinc-950/20"
            >
              <summary
                className={[
                  "cursor-pointer list-none rounded-xl px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden",
                  isActiveChapter
                    ? "text-zinc-950 dark:text-zinc-50"
                    : "text-zinc-700 dark:text-zinc-300"
                ].join(" ")}
              >
                <Link
                  href={chapterHref(chapter)}
                  className="hover:underline decoration-black/20 underline-offset-4 dark:decoration-white/20"
                  onClick={(event) => event.stopPropagation()}
                >
                  {getChapterLandingTitle(chapter.number, chapter.name)}
                </Link>
                <span className="ml-2 text-[11px] font-normal text-zinc-500 dark:text-zinc-500">
                  {grouped.length}
                </span>
              </summary>
              <ul className="space-y-0.5 px-2 pb-2">
                {grouped.map((example) => (
                  <li key={`${chapter.slug}-${example.exampleNum}`}>
                    <Link
                      href={example.href}
                      className={
                        isExamplePathActive(pathname, example.href) ? activeNavLinkClass : navLinkClass
                      }
                    >
                      {example.label}
                    </Link>
                  </li>
                ))}
                {chapter.number != null && chapterHasInfographic(chapter.number) ? (
                  <li>
                    <Link
                      href={chapterInfographicHref(chapter.number)}
                      className={
                        isChapterInfographicPathActive(pathname, chapter.number)
                          ? activeNavLinkClass
                          : navLinkClass
                      }
                    >
                      Infographic
                    </Link>
                  </li>
                ) : null}
                {chapter.number != null && chapterHasStudyGroupSessions(chapter.number) ? (
                  <li>
                    <Link
                      href={chapterStudyGroupHref(chapter.number)}
                      className={
                        isChapterStudyGroupPathActive(pathname, chapter.number)
                          ? activeNavLinkClass
                          : navLinkClass
                      }
                    >
                      Study group
                    </Link>
                  </li>
                ) : null}
                {chapter.number != null && chapterHasExercises(chapter.number) ? (
                  <li>
                    <Link
                      href={chapterExercisesHref(chapter.number)}
                      className={
                        isChapterExercisesPathActive(pathname, chapter.number)
                          ? activeNavLinkClass
                          : navLinkClass
                      }
                    >
                      Exercises
                    </Link>
                  </li>
                ) : null}
              </ul>
            </details>
          );
        })}
      </div>
    </nav>
  );
}
