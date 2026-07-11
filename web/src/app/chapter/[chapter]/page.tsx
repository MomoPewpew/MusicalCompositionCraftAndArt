import { notFound } from "next/navigation";

import { InfographicChapterLink } from "@/components/ChapterInfographic";
import { StudyGroupChapterLink } from "@/components/ChapterStudyGroup";
import { TeachingVideosChapterLink } from "@/components/ChapterTeachingVideos";
import { ExerciseChapterLink } from "@/components/ChapterExercises";
import { ExampleCard } from "@/components/ExamplePageView";
import { MobileChapterNav } from "@/components/MobileChapterNav";
import { getChapterLandingTitle } from "@/lib/chapterTitles";
import { getChapter, getChapters, getGroupedExamplesForChapter } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  return getChapters()
    .filter((chapter) => chapter.slug !== "extra")
    .map((chapter) => ({ chapter: String(chapter.number) }));
}

export default async function ChapterPage({
  params
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: chapterParam } = await params;
  const chapter = getChapter(`chapter-${chapterParam}`);
  if (!chapter) notFound();

  const grouped = getGroupedExamplesForChapter(chapter);
  const chapterTitle = getChapterLandingTitle(chapter.number, chapter.name);

  return (
    <div className="space-y-8">
      <MobileChapterNav />

      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {chapterTitle}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {grouped.length} example{grouped.length === 1 ? "" : "s"} in this chapter.
        </p>
      </div>

      {grouped.length > 0 ? (
        <ul className="space-y-2">
          {grouped.map((example) => (
            <li key={example.exampleNum}>
              <ExampleCard
                chapter={chapter}
                exampleNum={example.exampleNum}
                label={example.label}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No examples are available for this chapter yet.
        </p>
      )}

      <InfographicChapterLink chapter={chapter} />

      <StudyGroupChapterLink chapter={chapter} />

      <TeachingVideosChapterLink chapter={chapter} />

      <ExerciseChapterLink chapter={chapter} />
    </div>
  );
}
