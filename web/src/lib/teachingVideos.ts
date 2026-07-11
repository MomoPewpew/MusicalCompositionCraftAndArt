import teachingVideos from "@/generated/teaching-videos.json";
import type { YouTubeEmbedKind } from "@/lib/youtube";

export type TeachingVideo = {
  title: string;
  youtube: string;
  kind?: YouTubeEmbedKind;
  startSeconds?: number;
  description?: string;
};

export type ChapterTeachingVideos = {
  videos: TeachingVideo[];
};

export type TeachingVideosManifest = {
  chapters: Record<string, ChapterTeachingVideos>;
};

const manifest = teachingVideos as TeachingVideosManifest;

export function getTeachingVideosManifest(): TeachingVideosManifest {
  return manifest;
}

export function chapterHasTeachingVideos(chapterNumber: number | null | undefined): boolean {
  if (chapterNumber == null) return false;
  const videos = manifest.chapters[String(chapterNumber)]?.videos ?? [];
  return videos.length > 0;
}

export function getChapterTeachingVideos(
  chapterNumber: number | null | undefined
): ChapterTeachingVideos | null {
  if (chapterNumber == null) return null;
  const chapter = manifest.chapters[String(chapterNumber)];
  if (!chapter || chapter.videos.length === 0) return null;
  return chapter;
}

export function chapterTeachingVideosHref(chapterNumber: number): string {
  return `/chapter/${chapterNumber}/teaching-videos/`;
}

export function getChaptersWithTeachingVideos(): number[] {
  return Object.entries(manifest.chapters)
    .filter(([, chapter]) => chapter.videos.length > 0)
    .map(([chapter]) => Number(chapter))
    .filter((chapter) => Number.isFinite(chapter))
    .sort((a, b) => a - b);
}

export function isChapterTeachingVideosPathActive(
  pathname: string,
  chapterNumber: number
): boolean {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return normalized === chapterTeachingVideosHref(chapterNumber);
}
