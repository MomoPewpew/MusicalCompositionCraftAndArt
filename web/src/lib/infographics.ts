import infographics from "@/generated/infographics.json";

export type ChapterInfographicEntry = {
  image: string;
};

export type InfographicsManifest = {
  chapterCount: number;
  chapters: Record<string, ChapterInfographicEntry>;
};

const manifest = infographics as InfographicsManifest;

export function getInfographicsManifest(): InfographicsManifest {
  return manifest;
}

export function chapterHasInfographic(chapterNumber: number | null | undefined): boolean {
  if (chapterNumber == null) return false;
  return Boolean(manifest.chapters[String(chapterNumber)]?.image);
}

export function getChapterInfographic(
  chapterNumber: number | null | undefined
): ChapterInfographicEntry | null {
  if (chapterNumber == null) return null;
  return manifest.chapters[String(chapterNumber)] ?? null;
}

export function chapterInfographicHref(chapterNumber: number): string {
  return `/chapter/${chapterNumber}/infographic/`;
}

export function getChaptersWithInfographics(): number[] {
  return Object.keys(manifest.chapters)
    .map((chapter) => Number(chapter))
    .filter((chapter) => Number.isFinite(chapter) && manifest.chapters[String(chapter)]?.image)
    .sort((a, b) => a - b);
}

export function isChapterInfographicPathActive(pathname: string, chapterNumber: number): boolean {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return normalized === chapterInfographicHref(chapterNumber);
}
