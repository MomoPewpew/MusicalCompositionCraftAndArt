import { notFound } from "next/navigation";

import { ExamplePageView } from "@/components/ExamplePageView";
import { getManifest } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  return getManifest().examples
    .filter((example) => example.route.chapter !== "extra" && !example.route.section)
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
  const entry = getManifest().examples.find(
    (item) =>
      item.route.chapter === chapter &&
      item.route.example === example &&
      !item.route.section
  );
  if (!entry) notFound();

  return <ExamplePageView example={entry} />;
}
