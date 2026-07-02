import { notFound } from "next/navigation";

import { ExamplePageView } from "@/components/ExamplePageView";
import { getManifest } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  return getManifest().examples
    .filter((example) => example.route.chapter !== "extra" && example.route.section)
    .map((example) => ({
      chapter: example.route.chapter,
      example: example.route.example,
      section: example.route.section as string
    }));
}

export default async function SectionExamplePage({
  params
}: {
  params: Promise<{ chapter: string; example: string; section: string }>;
}) {
  const { chapter, example, section } = await params;
  const entry = getManifest().examples.find(
    (item) =>
      item.route.chapter === chapter &&
      item.route.example === example &&
      item.route.section === section
  );
  if (!entry) notFound();

  return <ExamplePageView example={entry} />;
}
