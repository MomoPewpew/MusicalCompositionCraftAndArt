import { notFound } from "next/navigation";

import type { Metadata } from "next";

import { ChapterStudyGroupPageView } from "@/components/ChapterStudyGroup";
import { MobileChapterNav } from "@/components/MobileChapterNav";
import { getChapter } from "@/lib/examples";
import {
  chapterHasStudyGroupSessions,
  getChaptersWithStudyGroupSessions
} from "@/lib/studyGroupSessions";

export const dynamicParams = false;

export function generateStaticParams() {
  return getChaptersWithStudyGroupSessions()
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
    title: `${chapter.name} — Study group`
  };
}

export default async function ChapterStudyGroupPage({
  params
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: chapterParam } = await params;
  const chapter = getChapter(`chapter-${chapterParam}`);
  if (!chapter || !chapterHasStudyGroupSessions(chapter.number)) notFound();

  return (
    <>
      <MobileChapterNav />
      <ChapterStudyGroupPageView chapter={chapter} />
    </>
  );
}
