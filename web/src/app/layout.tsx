import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";
import { BookSidebar } from "@/components/BookSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getManifest } from "@/lib/examples";

const manifest = getManifest();
const SOURCE_REPO_URL = "https://github.com/MomoPewpew/MusicalCompositionCraftAndArt";
const REALMUSIC_EXAMPLES_URL =
  "https://textbook.realmusictheory.com/?book=Musical+Composition+Craft+And+Art";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: manifest.book,
    template: `%s · ${manifest.book}`
  },
  description:
    "Musical examples from Alan Belkin's Musical Composition: Craft and Art, with sheet music, citations, and playback."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="min-h-dvh">
            <header className="sticky top-0 z-20 relative">
              <div className="pointer-events-none absolute inset-0 -z-10 border-b border-black/10 bg-white/70 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950/65" />
              <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <Link
                  href="/"
                  className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
                  aria-label="Go to home"
                >
                  <div className="h-8 w-8 rounded-xl border border-black/10 bg-gradient-to-br from-fuchsia-500/35 via-white to-teal-400/25 shadow-[0_0_0_1px_rgba(0,0,0,0.05)] dark:border-white/10 dark:from-fuchsia-500/40 dark:via-zinc-900 dark:to-teal-400/30" />
                  <div>
                    <div className="text-sm font-semibold tracking-wide text-zinc-950 dark:text-zinc-50">
                      Musical Composition
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">Craft and Art</div>
                  </div>
                </Link>
                <ThemeToggle />
              </div>
            </header>

            <div className="mx-auto flex max-w-7xl gap-8 px-6">
              <BookSidebar />
              <main className="min-w-0 flex-1 py-10">{children}</main>
            </div>

            <footer className="mx-auto max-w-7xl space-y-1 px-6 pb-12 pt-6 text-xs text-zinc-600 dark:text-zinc-500">
              <div>
                Examples from <span className="font-medium text-zinc-800 dark:text-zinc-200">Alan Belkin</span>
                , <em>Musical Composition: Craft and Art</em> (Yale University Press).
              </div>
              <div>
                Sheet music and MIDI compiled by{" "}
                <span className="font-medium text-zinc-800 dark:text-zinc-200">e7mac</span> at{" "}
                <a
                  href={REALMUSIC_EXAMPLES_URL}
                  className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40 dark:decoration-white/20 dark:hover:decoration-white/40"
                  target="_blank"
                  rel="noreferrer"
                >
                  Real Music Theory
                </a>
                .
              </div>
              <div>
                Made by <span className="font-medium text-zinc-800 dark:text-zinc-200">Marijn Tepas</span>.{" "}
                <a
                  href={SOURCE_REPO_URL}
                  className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40 dark:decoration-white/20 dark:hover:decoration-white/40"
                  target="_blank"
                  rel="noreferrer"
                >
                  Source code
                </a>
                .
              </div>
              <div>
                MIDI piano:{" "}
                <a
                  href="https://github.com/pianobooster/fluid-soundfont"
                  className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40 dark:decoration-white/20 dark:hover:decoration-white/40"
                  target="_blank"
                  rel="noreferrer"
                >
                  FluidR3_GM
                </a>{" "}
                by <span className="font-medium text-zinc-800 dark:text-zinc-200">Frank Wen</span> (MIT);{" "}
                <a
                  href="https://github.com/gleitz/midi-js-soundfonts"
                  className="underline decoration-black/20 underline-offset-4 hover:decoration-black/40 dark:decoration-white/20 dark:hover:decoration-white/40"
                  target="_blank"
                  rel="noreferrer"
                >
                  web samples
                </a>{" "}
                by <span className="font-medium text-zinc-800 dark:text-zinc-200">Benjamin Gleitzman</span> (CC BY 3.0).
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
