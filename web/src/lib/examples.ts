import examples from "@/generated/examples.json";

export type ExampleRoute = {
  chapter: string;
  example: string;
  section?: string;
};

export type ExampleAssets = {
  image: string | null;
  midi: string | null;
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

export function getChapters(): ChapterEntry[] {
  return manifest.chapters;
}

export function getChapter(slug: string): ChapterEntry | undefined {
  return manifest.chapters.find((chapter) => chapter.slug === slug);
}

export function getExampleBySlug(slug: string): ExampleEntry | undefined {
  return manifest.examples.find((example) => example.slug === slug);
}

export function getExampleHref(example: Pick<ExampleEntry, "route">): string {
  const { route } = example;
  if (route.chapter === "extra") {
    return `/extra/example/${route.example}/`;
  }
  if (route.section) {
    return `/chapter/${route.chapter}/example/${route.example}/section/${route.section}/`;
  }
  return `/chapter/${route.chapter}/example/${route.example}/`;
}

export function examplePageTitle(example: ExampleEntry): string {
  if (example.chapter === "Extra") {
    return `Extra — ${example.exampleLabel}`;
  }
  return `${example.chapter} — ${example.exampleLabel}`;
}
