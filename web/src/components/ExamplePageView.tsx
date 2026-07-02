import Link from "next/link";

import {
  examplePageTitle,
  getExampleHref,
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
  example
}: {
  chapter: ChapterEntry;
  example: ChapterEntry["examples"][number];
}) {
  return (
    <Link
      href={getExampleHref(example)}
      className={[
        "block rounded-xl border border-black/10 bg-white/60 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
        "transition hover:border-black/15 hover:bg-white",
        "dark:border-white/10 dark:bg-zinc-950/30 dark:hover:border-white/15 dark:hover:bg-zinc-950/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
      ].join(" ")}
    >
      <div className="text-sm font-medium text-zinc-950 dark:text-zinc-100">{example.exampleLabel}</div>
      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{example.id}</div>
    </Link>
  );
}

export function ExamplePageView({ example }: { example: ExampleEntry }) {
  const chapterHref =
    example.chapter === "Extra" ? "/extra/" : `/chapter/${example.chapterNumber}/`;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href={chapterHref}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to {example.chapter}
        </Link>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {examplePageTitle(example)}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{example.id}</p>
        </div>
      </div>

      <section className={glassCard}>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Citation
        </h2>
        <blockquote className="border-l-2 border-fuchsia-400/60 pl-4 text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
          {example.citation}
        </blockquote>
        {example.figureRef && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
            Textbook reference: Figure {example.figureRef}
          </p>
        )}
      </section>

      <section className={glassCard}>
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Sheet Music
        </h2>
        {example.assets.image ? (
          <figure className="overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950/40">
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
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          Playback
        </h2>
        {example.assets.mockupAudio ? (
          <AudioPlayback src={example.assets.mockupAudio} />
        ) : (
          <MockupUnavailableBlurb />
        )}
        {example.assets.midi ? <MidiPlayback src={example.assets.midi} /> : null}
      </section>
    </div>
  );
}
