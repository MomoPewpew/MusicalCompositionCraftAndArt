import { notFound } from "next/navigation";

import { InfographicChapterLink } from "@/components/ChapterInfographic";
import { ExerciseChapterLink } from "@/components/ChapterExercises";
import { ExampleCard } from "@/components/ExamplePageView";
import { MobileChapterNav } from "@/components/MobileChapterNav";
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

  return (
    <div className="space-y-8">
      <MobileChapterNav />

      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {chapter.name}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {grouped.length} example{grouped.length === 1 ? "" : "s"} in this chapter.
        </p>
      </div>

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

      <InfographicChapterLink chapter={chapter} />

      <ExerciseChapterLink chapter={chapter} />
    </div>
  );
}
