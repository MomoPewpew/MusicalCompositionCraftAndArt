import { notFound } from "next/navigation";

import { GroupedExamplePageView } from "@/components/ExamplePageView";
import { MobileChapterNav } from "@/components/MobileChapterNav";
import { getExampleParts, getManifest } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  const seen = new Set<string>();
  return getManifest().examples
    .filter((example) => example.route.chapter !== "extra")
    .filter((example) => {
      const key = `${example.route.chapter}-${example.route.example}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((example) => ({
      chapter: example.route.chapter,
      example: example.route.example
    }));
}

export default async function ExamplePage({
  params
}: {
  params: Promise<{ chapter: string; example: string }>;
}) {
  const { chapter, example } = await params;
  const parts = getExampleParts(chapter, example);
  if (!parts.length) notFound();

  return (
    <>
      <MobileChapterNav />
      <GroupedExamplePageView
        chapter={parts[0].chapter}
        exampleNum={example}
        parts={parts}
      />
    </>
  );
}
