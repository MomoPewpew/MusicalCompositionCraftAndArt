import examples from "@/generated/examples.json";
import { getChaptersWithExercises } from "@/lib/exerciseAssets";
import { getChaptersWithInfographics } from "@/lib/infographics";
import { getChaptersWithStudyGroupSessions } from "@/lib/studyGroupSessions";

export type ExampleRoute = {
  chapter: string;
  example: string;
  section?: string;
};

export type ExampleAssets = {
  image: string | null;
  midi: string | null;
  midiHumanized: string | null;
  mockupAudio: string | null;
};

export type ExampleEntry = {
  id: string;
  slug: string;
  route: ExampleRoute;
  chapter: string;
  chapterNumber: number | null;
  exampleLabel: string;
  figureRef: string | null;
  citation: string;
  citationKind: string;
  assets: ExampleAssets;
};

export type ChapterEntry = {
  name: string;
  number: number | null;
  slug: string;
  exampleCount: number;
  examples: Array<{
    id: string;
    slug: string;
    exampleLabel: string;
    route: ExampleRoute;
  }>;
};

export type GroupedExampleNav = {
  exampleNum: string;
  label: string;
  href: string;
  hasSections: boolean;
};

export type ExamplesManifest = {
  book: string;
  exampleCount: number;
  chapters: ChapterEntry[];
  examples: ExampleEntry[];
};

const manifest = examples as ExamplesManifest;

export function getManifest(): ExamplesManifest {
  return manifest;
}

function getAllChapters(): ChapterEntry[] {
  const chapters = [...manifest.chapters];

  const extraChapter = chapters.find((chapter) => chapter.slug === "extra") ?? null;
  const numbered = chapters.filter((chapter) => chapter.slug !== "extra" && chapter.number != null);
  const existingNumbers = new Set(numbered.map((chapter) => chapter.number as number));

  const supplementalNumbers = new Set<number>();
  for (const chapter of getChaptersWithInfographics()) supplementalNumbers.add(chapter);
  for (const chapter of getChaptersWithStudyGroupSessions()) supplementalNumbers.add(chapter);
  for (const chapter of getChaptersWithExercises()) supplementalNumbers.add(chapter);

  for (const number of supplementalNumbers) {
    if (existingNumbers.has(number)) continue;
    numbered.push({
      name: `Chapter ${number}`,
      number,
      slug: `chapter-${number}`,
      exampleCount: 0,
      examples: []
    });
  }

  numbered.sort((a, b) => (a.number as number) - (b.number as number));
  return extraChapter ? [...numbered, extraChapter] : numbered;
}

export function getChapters(): ChapterEntry[] {
  return getAllChapters();
}

export function getChapter(slug: string): ChapterEntry | undefined {
  return getAllChapters().find((chapter) => chapter.slug === slug);
}

export function getChapterByNumber(number: number): ChapterEntry | undefined {
  return getAllChapters().find((chapter) => chapter.number === number);
}

export function getExampleBySlug(slug: string): ExampleEntry | undefined {
  return manifest.examples.find((example) => example.slug === slug);
}

export function chapterHref(chapter: ChapterEntry): string {
  return chapter.slug === "extra" ? "/extra/" : `/chapter/${chapter.number}/`;
}

export function exampleHref(route: ExampleRoute): string {
  if (route.chapter === "extra") {
    return `/extra/example/${route.example}/`;
  }
  return `/chapter/${route.chapter}/example/${route.example}/`;
}

/** @deprecated Use exampleHref */
export function getExampleHref(example: Pick<ExampleEntry, "route">): string {
  return exampleHref(example.route);
}

export function getGroupedExamplesForChapter(chapter: ChapterEntry): GroupedExampleNav[] {
  const groups = new Map<string, GroupedExampleNav>();

  for (const entry of chapter.examples) {
    const exampleNum = entry.route.example;
    if (!groups.has(exampleNum)) {
      groups.set(exampleNum, {
        exampleNum,
        label: `Example ${exampleNum}`,
        href: exampleHref(entry.route),
        hasSections: false
      });
    }
    if (entry.route.section) {
      groups.get(exampleNum)!.hasSections = true;
    }
  }

  return [...groups.values()].sort((a, b) => Number(a.exampleNum) - Number(b.exampleNum));
}

export function getExampleParts(chapterKey: string, exampleNum: string): ExampleEntry[] {
  return manifest.examples
    .filter(
      (entry) => entry.route.chapter === chapterKey && entry.route.example === exampleNum
    )
    .sort((a, b) => {
      const sectionA = a.route.section ? Number(a.route.section) : 0;
      const sectionB = b.route.section ? Number(b.route.section) : 0;
      return sectionA - sectionB;
    });
}

export function groupedExamplePageTitle(chapter: string, exampleNum: string): string {
  if (chapter === "Extra") {
    return `Extra — Example ${exampleNum}`;
  }
  const chapterEntry = getChapters().find((item) => item.name === chapter);
  const chapterName = chapterEntry?.name ?? chapter;
  return `${chapterName} — Example ${exampleNum}`;
}

export function examplePageTitle(example: ExampleEntry): string {
  if (example.chapter === "Extra") {
    return `Extra — ${example.exampleLabel}`;
  }
  return `${example.chapter} — ${example.exampleLabel}`;
}

export function parseActiveChapterFromPath(pathname: string): string | null {
  if (pathname === "/extra" || pathname.startsWith("/extra/")) {
    return "extra";
  }
  const match = pathname.match(/^\/chapter\/(\d+)(?:\/|$)/);
  if (match) {
    return `chapter-${match[1]}`;
  }
  return null;
}

export function isExamplePathActive(pathname: string, href: string): boolean {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const target = href.endsWith("/") ? href : `${href}/`;
  return normalized === target;
}
