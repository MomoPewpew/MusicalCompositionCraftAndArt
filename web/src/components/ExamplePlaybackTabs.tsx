"use client";

import { useState } from "react";

import { AudioPlayback, MidiPlayback } from "@/components/PlaybackPanel";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import type { ExampleYouTubeRecording } from "@/lib/exampleYouTube";

type PlaybackTabId = "youtube" | "archive" | "mockup" | "midi";

type ExamplePlaybackTabsProps = {
  exampleId: string;
  youtube: ExampleYouTubeRecording | null;
  mockupAudio: string | null;
  midi: string | null;
  midiHumanized: string | null;
};

const TABS: Array<{ id: PlaybackTabId; label: string }> = [
  { id: "youtube", label: "YouTube" },
  { id: "archive", label: "YouTube archive" },
  { id: "mockup", label: "Mockup" },
  { id: "midi", label: "MIDI" }
];

function firstAvailableTab(available: Record<PlaybackTabId, boolean>): PlaybackTabId | null {
  for (const tab of TABS) {
    if (available[tab.id]) return tab.id;
  }
  return null;
}

export function ExamplePlaybackTabs({
  exampleId,
  youtube,
  mockupAudio,
  midi,
  midiHumanized
}: ExamplePlaybackTabsProps) {
  const available: Record<PlaybackTabId, boolean> = {
    youtube: Boolean(youtube?.youtube),
    archive: Boolean(youtube?.archiveAudio),
    mockup: Boolean(mockupAudio),
    midi: Boolean(midi)
  };

  const initialTab = firstAvailableTab(available);
  const [activeTab, setActiveTab] = useState<PlaybackTabId | null>(initialTab);

  const selected =
    activeTab && available[activeTab] ? activeTab : firstAvailableTab(available);

  if (!selected) {
    return (
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        No playback is available for this example yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Playback style"
        className="flex flex-wrap gap-1 rounded-xl border border-black/10 bg-white/50 p-1 dark:border-white/10 dark:bg-zinc-950/40"
      >
        {TABS.map((tab) => {
          const isAvailable = available[tab.id];
          const isActive = selected === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`playback-tab-${exampleId}-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`playback-panel-${exampleId}-${tab.id}`}
              disabled={!isAvailable}
              title={isAvailable ? tab.label : `${tab.label} unavailable`}
              onClick={() => {
                if (isAvailable) setActiveTab(tab.id);
              }}
              className={[
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20",
                isActive
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                  : isAvailable
                    ? "text-zinc-700 hover:bg-white/70 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900/70 dark:hover:text-zinc-50"
                    : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`playback-panel-${exampleId}-${selected}`}
        aria-labelledby={`playback-tab-${exampleId}-${selected}`}
      >
        {selected === "youtube" && youtube ? (
          <div className="space-y-3">
            {youtube.label ? (
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {youtube.label}
              </p>
            ) : null}
            <YouTubeEmbed
              youtube={youtube.youtube}
              startSeconds={youtube.startSeconds}
              endSeconds={youtube.endSeconds}
              title={
                youtube.label ? `${exampleId} — ${youtube.label}` : `Recording for ${exampleId}`
              }
            />
          </div>
        ) : null}

        {selected === "archive" && youtube?.archiveAudio ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Audio archived from the YouTube recording above. Use this if the video is
              removed, embedding is disabled, or playback is blocked in your country.
            </p>
            <AudioPlayback src={youtube.archiveAudio} label="YouTube archive" />
          </div>
        ) : null}

        {selected === "mockup" && mockupAudio ? <AudioPlayback src={mockupAudio} /> : null}

        {selected === "midi" && midi ? (
          <MidiPlayback src={midi} humanizedSrc={midiHumanized} />
        ) : null}
      </div>
    </div>
  );
}
