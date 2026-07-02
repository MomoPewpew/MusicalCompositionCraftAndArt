import { notFound } from "next/navigation";

import { GroupedExamplePageView } from "@/components/ExamplePageView";
import { MobileChapterNav } from "@/components/MobileChapterNav";
import { getExampleParts } from "@/lib/examples";

export const dynamicParams = false;

export function generateStaticParams() {
  return [
    { example: "1" },
    { example: "2" }
  ];
}

export default async function ExtraExamplePage({
  params
}: {
  params: Promise<{ example: string }>;
}) {
  const { example } = await params;
  const parts = getExampleParts("extra", example);
  if (!parts.length) notFound();

  return (
    <>
      <MobileChapterNav />
      <GroupedExamplePageView chapter="Extra" exampleNum={example} parts={parts} />
    </>
  );
}
