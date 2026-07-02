import { notFound } from "next/navigation";

import { ExamplePageView } from "@/components/ExamplePageView";
import { getManifest } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  return getManifest().examples
    .filter((example) => example.route.chapter === "extra")
    .map((example) => ({ example: example.route.example }));
}

export default async function ExtraExamplePage({
  params
}: {
  params: Promise<{ example: string }>;
}) {
  const { example } = await params;
  const entry = getManifest().examples.find(
    (item) => item.route.chapter === "extra" && item.route.example === example
  );
  if (!entry) notFound();

  return <ExamplePageView example={entry} />;
}
