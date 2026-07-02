import Link from "next/link";
import { notFound } from "next/navigation";

import { ExampleCard } from "@/components/ExamplePageView";
import { getChapter, getChapters } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  return getChapters()
    .filter((chapter) => chapter.slug !== "extra")
    .map((chapter) => ({ chapter: String(chapter.number) }));
}

export default async function ChapterPage({
  params
}: {
  params: Promise<{ chapter: string }>;
}) {
  const { chapter: chapterParam } = await params;
  const chapter = getChapter(`chapter-${chapterParam}`);
  if (!chapter) notFound();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          ← All chapters
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {chapter.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {chapter.exampleCount} example{chapter.exampleCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {chapter.examples.map((example) => (
          <ExampleCard key={example.id} chapter={chapter} example={example} />
        ))}
      </div>
    </div>
  );
}
