import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { ChapterTeachingVideosPageView } from "@/components/ChapterTeachingVideos";
import { MobileChapterNav } from "@/components/MobileChapterNav";
import { getChapter } from "@/lib/examples";
import {
  chapterHasTeachingVideos,
  getChaptersWithTeachingVideos
} from "@/lib/teachingVideos";

export const dynamicParams = false;

export function generateStaticParams() {
  return getChaptersWithTeachingVideos()
    .filter((chapter) => getChapter(`chapter-${chapter}`))
    .map((chapter) => ({ chapter: String(chapter) }));
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
    title: `${chapter.name} — Teaching videos`
  };
}

export default async function ChapterTeachingVideosPage({
  params
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: chapterParam } = await params;
  const chapter = getChapter(`chapter-${chapterParam}`);
  if (!chapter || !chapterHasTeachingVideos(chapter.number)) notFound();

  return (
    <>
      <MobileChapterNav />
      <ChapterTeachingVideosPageView chapter={chapter} />
    </>
  );
}
