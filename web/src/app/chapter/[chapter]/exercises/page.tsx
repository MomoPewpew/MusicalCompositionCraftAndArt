import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { ChapterExercisesPageView } from "@/components/ChapterExercises";
import { MobileChapterNav } from "@/components/MobileChapterNav";
import { chapterHasExercises, getChaptersWithExercises } from "@/lib/exerciseAssets";
import { getChapter } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  return getChaptersWithExercises().map((chapter) => ({ chapter: String(chapter) }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ chapter: string }>;
}): Promise<Metadata> {
  const { chapter: chapterParam } = await params;
  const chapter = getChapter(`chapter-${chapterParam}`);
  if (!chapter) return {};
  return {
    title: `${chapter.name} — Exercises`
  };
}

export default async function ChapterExercisesPage({
  params
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: chapterParam } = await params;
  const chapter = getChapter(`chapter-${chapterParam}`);
  if (!chapter || !chapterHasExercises(chapter.number)) notFound();

  return (
    <>
      <MobileChapterNav />
      <ChapterExercisesPageView chapter={chapter} />
    </>
  );
}
