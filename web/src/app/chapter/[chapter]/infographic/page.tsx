import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { ChapterInfographicPageView } from "@/components/ChapterInfographic";
import { MobileChapterNav } from "@/components/MobileChapterNav";
import {
  chapterHasInfographic,
  getChaptersWithInfographics
} from "@/lib/infographics";
import { getChapter } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  return getChaptersWithInfographics()
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
    title: `${chapter.name} — Infographic`
  };
}

export default async function ChapterInfographicPage({
  params
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: chapterParam } = await params;
  const chapter = getChapter(`chapter-${chapterParam}`);
  if (!chapter || !chapterHasInfographic(chapter.number)) notFound();

  return (
    <>
      <MobileChapterNav />
      <ChapterInfographicPageView chapter={chapter} />
    </>
  );
}
