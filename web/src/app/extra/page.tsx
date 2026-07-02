import Link from "next/link";

import { ExampleCard } from "@/components/ExamplePageView";
import { getChapter } from "@/lib/examples";

export const dynamicParams = false;

export default function ExtraChapterPage() {
  const chapter = getChapter("extra");
  if (!chapter) {
    return null;
  }

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
