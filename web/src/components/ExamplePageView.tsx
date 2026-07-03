import Link from "next/link";

import {
  chapterHref,
  exampleHref,
  getGroupedExamplesForChapter,
  groupedExamplePageTitle,
  type ChapterEntry,
  type ExampleEntry
} from "@/lib/examples";
import { AudioPlayback, MidiPlayback, MockupUnavailableBlurb } from "@/components/PlaybackPanel";

const glassCard = [
  "rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
  "dark:border-white/10 dark:bg-zinc-950/30 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
].join(" ");

export function ExampleCard({
  chapter,
  exampleNum,
  label
}: {
  chapter: ChapterEntry;
  exampleNum: string;
  label: string;
}) {
  return (
    <Link
      href={exampleHref({
        chapter: chapter.slug === "extra" ? "extra" : String(chapter.number),
        example: exampleNum
      })}
      className={[
        "block rounded-xl border border-black/10 bg-white/60 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
        "transition hover:border-black/15 hover:bg-white",
        "dark:border-white/10 dark:bg-zinc-950/30 dark:hover:border-white/15 dark:hover:bg-zinc-950/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
      ].join(" ")}
    >
      <div className="text-sm font-medium text-zinc-950 dark:text-zinc-100">{label}</div>
    </Link>
  );
}

function ExampleSectionView({ example }: { example: ExampleEntry }) {
  return (
    <div className="space-y-6">
      <section className={glassCard}>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Citation
        </h3>
        <blockquote className="border-l-2 border-fuchsia-400/60 pl-4 text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
          {example.citation}
        </blockquote>
        {example.figureRef && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
            Textbook reference: Figure {example.figureRef}
            {example.route.section ? ` (section ${example.route.section})` : ""}
          </p>
        )}
      </section>

      <section className={glassCard}>
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Sheet Music
        </h3>
        {example.assets.image ? (
          <figure className="score-sheet">
            {/* eslint-disable-next-line @next/next/no-img-element -- static PNG scores from textbook */}
            <img
              src={example.assets.image}
              alt={`Sheet music for ${example.id}`}
              className="mx-auto block h-auto w-full max-w-full object-contain"
            />
          </figure>
        ) : (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Sheet music image is not available for this example.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Playback
        </h3>
        {example.assets.mockupAudio ? (
          <AudioPlayback src={example.assets.mockupAudio} />
        ) : (
          <MockupUnavailableBlurb />
        )}
        {example.assets.midi ? (
          <MidiPlayback
            src={example.assets.midi}
            humanizedSrc={example.assets.midiHumanized}
          />
        ) : null}
      </section>
    </div>
  );
}

export function GroupedExamplePageView({
  chapter,
  exampleNum,
  parts
}: {
  chapter: string;
  exampleNum: string;
  parts: ExampleEntry[];
}) {
  const hasSections = parts.length > 1 || parts[0]?.route.section;
  const backHref =
    chapter === "Extra"
      ? "/extra/"
      : `/chapter/${parts[0]?.chapterNumber ?? parts[0]?.route.chapter}/`;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to {chapter}
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {groupedExamplePageTitle(chapter, exampleNum)}
          </h1>
        </div>
      </div>

      {hasSections ? (
        <div className="space-y-10">
          {parts.map((example) => (
            <section key={example.id} className="space-y-6">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Section {example.route.section}
              </h2>
              <ExampleSectionView example={example} />
            </section>
          ))}
        </div>
      ) : (
        <ExampleSectionView example={parts[0]} />
      )}
    </div>
  );
}
