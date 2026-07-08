import chapterTitles from "@/generated/chapter-titles.json";

export type ChapterTitlesManifest = {
  chapters: Record<string, string>;
};

const manifest = chapterTitles as ChapterTitlesManifest;

export function getChapterTopicTitle(chapterNumber: number | null | undefined): string | null {
  if (chapterNumber == null) return null;
  return manifest.chapters[String(chapterNumber)] ?? null;
}

/** Sidebar and chapter landing page only — "Chapter N — Topic" when a title exists. */
export function getChapterLandingTitle(
  chapterNumber: number | null | undefined,
  chapterName: string
): string {
  const topic = getChapterTopicTitle(chapterNumber);
  return topic ? `${chapterName} — ${topic}` : chapterName;
}
