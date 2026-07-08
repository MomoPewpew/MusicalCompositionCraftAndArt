import studyGroupSessions from "@/generated/study-group-sessions.json";

export type StudyGroupSession = {
  title: string;
  youtube: string;
  startSeconds?: number;
  description?: string;
};

export type ChapterStudyGroupSessions = {
  sessions: StudyGroupSession[];
};

export type StudyGroupSessionsManifest = {
  chapters: Record<string, ChapterStudyGroupSessions>;
};

const manifest = studyGroupSessions as StudyGroupSessionsManifest;

export function getStudyGroupSessionsManifest(): StudyGroupSessionsManifest {
  return manifest;
}

export function chapterHasStudyGroupSessions(chapterNumber: number | null | undefined): boolean {
  if (chapterNumber == null) return false;
  const sessions = manifest.chapters[String(chapterNumber)]?.sessions ?? [];
  return sessions.length > 0;
}

export function getChapterStudyGroupSessions(
  chapterNumber: number | null | undefined
): ChapterStudyGroupSessions | null {
  if (chapterNumber == null) return null;
  const chapter = manifest.chapters[String(chapterNumber)];
  if (!chapter || chapter.sessions.length === 0) return null;
  return chapter;
}

export function chapterStudyGroupHref(chapterNumber: number): string {
  return `/chapter/${chapterNumber}/study-group/`;
}

export function getChaptersWithStudyGroupSessions(): number[] {
  return Object.entries(manifest.chapters)
    .filter(([, chapter]) => chapter.sessions.length > 0)
    .map(([chapter]) => Number(chapter))
    .filter((chapter) => Number.isFinite(chapter))
    .sort((a, b) => a - b);
}

export function isChapterStudyGroupPathActive(pathname: string, chapterNumber: number): boolean {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return normalized === chapterStudyGroupHref(chapterNumber);
}
