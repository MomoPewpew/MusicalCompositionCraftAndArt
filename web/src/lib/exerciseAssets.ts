import exerciseAssets from "@/generated/exercise-assets.json";

export type ExerciseChapterAssets = {
  fileCount: number;
  files: string[];
  archive: string | null;
};

export type ExerciseAssetsManifest = {
  fileCount: number;
  chapters: Record<string, ExerciseChapterAssets>;
};

const manifest = exerciseAssets as ExerciseAssetsManifest;

export function getExerciseAssetsManifest(): ExerciseAssetsManifest {
  return manifest;
}

export function chapterHasExercises(chapterNumber: number | null | undefined): boolean {
  if (chapterNumber == null) return false;
  const chapter = manifest.chapters[String(chapterNumber)];
  return Boolean(chapter && chapter.fileCount > 0 && chapter.archive);
}

export function chapterExercisesHref(chapterNumber: number): string {
  return `/chapter/${chapterNumber}/exercises/`;
}

export function getChapterExerciseAssets(
  chapterNumber: number | null | undefined
): (ExerciseChapterAssets & { archive: string }) | null {
  if (chapterNumber == null) return null;

  const chapter = manifest.chapters[String(chapterNumber)];
  if (!chapter || chapter.fileCount === 0 || !chapter.archive) return null;

  return chapter as ExerciseChapterAssets & { archive: string };
}

export function getChaptersWithExercises(): number[] {
  return Object.entries(manifest.chapters)
    .filter(([, chapter]) => chapter.fileCount > 0 && chapter.archive)
    .map(([chapter]) => Number(chapter))
    .filter((chapter) => Number.isFinite(chapter))
    .sort((a, b) => a - b);
}

export function isChapterExercisesPathActive(pathname: string, chapterNumber: number): boolean {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return normalized === chapterExercisesHref(chapterNumber);
}
