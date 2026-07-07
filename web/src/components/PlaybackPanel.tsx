"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";

import { registerMidiPlayer, resetOtherMidiPlayers } from "@/lib/midiPlaybackCoordinator";
import { loadPianoSoundfont, resetPianoSoundfont } from "@/lib/pianoSoundfont";
import {
  readMidiHumanize,
  readMidiTempo,
  readMidiVolume,
  readMockupVolume,
  subscribeMidiHumanize,
  subscribeMidiVolume,
  subscribeMockupVolume,
  writeMidiHumanize,
  writeMidiTempo,
  writeMidiVolume,
  writeMockupVolume
} from "@/lib/playbackPreferences";

const MIDI_GAIN_BOOST = 2;

type MidiNoteEvent = {
  time: number;
  note: string;
  duration: number;
  velocity: number;
};

function tempoFactor(tempoPercent: number): number {
  return tempoPercent / 100;
}

function scoreDuration(midiDuration: number, tempoPercent: number): number {
  return midiDuration / tempoFactor(tempoPercent);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const cardClass = [
  "rounded-xl border border-black/10 bg-white/60 p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
  "dark:border-white/10 dark:bg-zinc-950/30 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
].join(" ");

const innerClass =
  "rounded-lg border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-zinc-950/40";

type PlaybackShellProps = {
  label: string;
  badge: string;
  isPlaying: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  volumeMax?: number;
  onPlayPause: () => void;
  onSeek: (value: number) => void;
  onVolumeChange: (value: number) => void;
  footer?: React.ReactNode;
  disabled?: boolean;
};

function PlaybackShell({
  label,
  badge,
  isPlaying,
  ended,
  currentTime,
  duration,
  volume,
  volumeMax = 100,
  onPlayPause,
  onSeek,
  onVolumeChange,
  footer,
  disabled = false
}: PlaybackShellProps) {
  const playButtonLabel = isPlaying ? "Pause" : ended ? "Replay" : "Play";
  return (
    <div className={cardClass}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-zinc-950 dark:text-zinc-100">{label}</div>
        <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          {badge}
        </div>
      </div>

      <div className={innerClass}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onPlayPause}
            disabled={disabled}
            className={[
              "inline-flex min-w-20 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium",
              "border-zinc-300/60 bg-white/80 text-zinc-900 hover:bg-white",
              "dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-900",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
            ].join(" ")}
          >
            {playButtonLabel}
          </button>

          <div className="min-w-[5.5rem] text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.05}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={disabled || duration <= 0}
            className="min-w-[8rem] flex-1"
            aria-label="Seek"
          />

          <div className="flex min-w-[10rem] items-center gap-2">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-500">Vol</span>
            <input
              type="range"
              min={0}
              max={volumeMax}
              step={1}
              value={volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
              disabled={disabled}
              className="flex-1"
              aria-label="Volume"
              aria-valuemin={0}
              aria-valuemax={volumeMax}
              aria-valuenow={volume}
              aria-valuetext={`${volume}%`}
            />
            <span className="min-w-[2.75rem] text-right text-[11px] tabular-nums text-zinc-500 dark:text-zinc-500">
              {volume}%
            </span>
          </div>
        </div>

        {footer}
      </div>
    </div>
  );
}

export function AudioPlayback({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    setVolumeState(readMockupVolume());
    return subscribeMockupVolume((value) => {
      setVolumeState(value);
    });
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.min(200, Math.max(0, Math.round(value)));
    setVolumeState(clamped);
    writeMockupVolume(clamped);
  }, []);

  useEffect(() => {
    setEnded(false);
    setIsPlaying(false);
    setCurrentTime(0);
    const audio = new Audio(src);
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setEnded(true);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, volume / 100);
    }
  }, [volume]);

  const onPlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (ended || (duration > 0 && audio.currentTime >= duration - 0.05)) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setEnded(false);
    }
    await audio.play();
    setIsPlaying(true);
  }, [duration, ended]);

  const onSeek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
    if (duration > 0 && value < duration - 0.05) {
      setEnded(false);
    }
  }, [duration]);

  return (
    <PlaybackShell
      label="Mockup"
      badge={src.split(".").pop()?.toLowerCase() ?? "audio"}
      isPlaying={isPlaying}
      ended={ended}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      volumeMax={200}
      onPlayPause={onPlayPause}
      onSeek={onSeek}
      onVolumeChange={setVolume}
    />
  );
}

export function MidiPlayback({
  src,
  humanizedSrc = null
}: {
  src: string;
  humanizedSrc?: string | null;
}) {
  const canHumanize = Boolean(humanizedSrc);
  const [humanize, setHumanizeState] = useState(() => readMidiHumanize());
  const activeSrc = humanize && humanizedSrc ? humanizedSrc : src;
  const midiRef = useRef<Midi | null>(null);
  const pianoRef = useRef<Awaited<ReturnType<typeof loadPianoSoundfont>> | null>(null);
  const eventsRef = useRef<MidiNoteEvent[]>([]);
  const playAnchorRef = useRef({ contextTime: 0, scoreOffset: 0 });
  const playingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [tempo, setTempoState] = useState(100);
  const [ended, setEnded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tempoRef = useRef(100);
  const currentTimeRef = useRef(0);

  const getAudioContext = useCallback(() => {
    return Tone.getContext().rawContext as AudioContext;
  }, []);

  const scorePosition = useCallback(() => {
    const factor = tempoFactor(tempoRef.current);
    const elapsed = Math.max(0, getAudioContext().currentTime - playAnchorRef.current.contextTime);
    return playAnchorRef.current.scoreOffset + elapsed * factor;
  }, [getAudioContext]);

  const stopNotes = useCallback(() => {
    pianoRef.current?.instrument.stop();
  }, []);

  const buildEvents = useCallback((midi: Midi, tempoPercent: number) => {
    const events: MidiNoteEvent[] = [];
    for (const track of midi.tracks) {
      for (const note of track.notes) {
        events.push({
          time: note.time,
          note: note.name,
          duration: note.duration,
          velocity: note.velocity
        });
      }
    }
    eventsRef.current = events;
    setDuration(scoreDuration(midi.duration, tempoPercent));
  }, []);

  const scheduleFrom = useCallback(
    (offset: number, tempoPercent: number) => {
      const piano = pianoRef.current;
      const events = eventsRef.current;
      if (!piano || events.length === 0) return;

      const factor = tempoFactor(tempoPercent);
      const context = getAudioContext();
      const startTime = context.currentTime + 0.05;
      const safeOffset = Math.max(0, offset);

      playAnchorRef.current = { contextTime: startTime, scoreOffset: safeOffset };

      for (const event of events) {
        if (event.time < safeOffset - 0.001) continue;
        const when = startTime + (event.time - safeOffset) / factor;
        if (when < context.currentTime) continue;
        piano.instrument.play(event.note, when, {
          duration: event.duration / factor,
          gain: Math.max(0.05, event.velocity)
        });
      }
    },
    [getAudioContext]
  );

  useEffect(() => {
    setVolumeState(readMidiVolume());
    return subscribeMidiVolume((value) => {
      setVolumeState(value);
    });
  }, []);

  useEffect(() => {
    setHumanizeState(readMidiHumanize());
    return subscribeMidiHumanize((enabled) => {
      setHumanizeState(enabled);
    });
  }, []);

  useEffect(() => {
    const savedTempo = readMidiTempo(src);
    setTempoState(savedTempo);
    tempoRef.current = savedTempo;
  }, [src]);

  const setHumanize = useCallback((enabled: boolean) => {
    setHumanizeState(enabled);
    writeMidiHumanize(enabled);
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.min(200, Math.max(0, Math.round(value)));
    setVolumeState(clamped);
    writeMidiVolume(clamped);
  }, []);

  const setTempo = useCallback(
    (value: number) => {
      const clamped = Math.min(150, Math.max(50, Math.round(value)));
      setTempoState(clamped);
      writeMidiTempo(src, clamped);
    },
    [src]
  );

  const applyVolume = useCallback((piano: Awaited<ReturnType<typeof loadPianoSoundfont>>, percent: number) => {
    piano.masterGain.gain.value = (percent / 100) * MIDI_GAIN_BOOST;
  }, []);

  const ensurePiano = useCallback(async () => {
    if (pianoRef.current) return pianoRef.current;
    try {
      pianoRef.current = await loadPianoSoundfont();
    } catch {
      resetPianoSoundfont();
      pianoRef.current = await loadPianoSoundfont();
    }
    return pianoRef.current;
  }, []);

  const pauseSelf = useCallback(() => {
    if (playingRef.current) {
      setCurrentTime(Math.min(scorePosition(), duration));
      stopNotes();
      playingRef.current = false;
      setIsPlaying(false);
    }
  }, [duration, scorePosition, stopNotes]);

  const resetSelf = useCallback(() => {
    if (playingRef.current) {
      stopNotes();
    }
    playingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(0);
    setEnded(false);
    playAnchorRef.current = { contextTime: 0, scoreOffset: 0 };
  }, [stopNotes]);

  useEffect(() => registerMidiPlayer(src, resetSelf), [resetSelf, src]);

  tempoRef.current = tempo;
  currentTimeRef.current = currentTime;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setReady(false);
      setLoadError(null);
      if (playingRef.current) {
        stopNotes();
        playingRef.current = false;
        setIsPlaying(false);
      }
      eventsRef.current = [];
      pianoRef.current = null;
      midiRef.current = null;

      try {
        const midiResponse = await fetch(activeSrc, { cache: "no-store" });
        if (!midiResponse.ok) {
          throw new Error(`MIDI fetch failed (${midiResponse.status})`);
        }

        const buffer = await midiResponse.arrayBuffer();
        const midi = new Midi(buffer);
        if (cancelled) return;

        midiRef.current = midi;
        buildEvents(midi, tempoRef.current);
        setCurrentTime(0);
        setEnded(false);
        setReady(true);

        void ensurePiano()
          .then((piano) => {
            if (cancelled || midiRef.current !== midi) return;
            pianoRef.current = piano;
            applyVolume(piano, volume);
          })
          .catch((error) => {
            if (cancelled) return;
            resetPianoSoundfont();
            console.error("Piano soundfont failed to preload:", error);
          });
      } catch (error) {
        if (cancelled) return;
        console.error("MIDI playback failed to load:", error);
        setLoadError("Playback failed to load. Refresh the page to try again.");
      }
    }

    void load();

    return () => {
      cancelled = true;
      resetSelf();
      eventsRef.current = [];
      pianoRef.current = null;
      midiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volume applied via separate effect
  }, [activeSrc, applyVolume, buildEvents, ensurePiano, resetSelf, stopNotes]);

  useEffect(() => {
    const midi = midiRef.current;
    if (!midi || !ready) return;
    const wasPlaying = playingRef.current;
    const position = wasPlaying ? scorePosition() : currentTimeRef.current;
    buildEvents(midi, tempo);
    if (wasPlaying) {
      stopNotes();
      scheduleFrom(position, tempo);
      setCurrentTime(position);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when user changes tempo
  }, [tempo]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!playingRef.current) return;
      const time = Math.min(scorePosition(), duration);
      setCurrentTime(time);
      if (duration > 0 && time >= duration - 0.05) {
        stopNotes();
        playingRef.current = false;
        setIsPlaying(false);
        setEnded(true);
        setCurrentTime(duration);
        playAnchorRef.current = { contextTime: 0, scoreOffset: 0 };
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [duration, scorePosition, stopNotes]);

  useEffect(() => {
    if (pianoRef.current) {
      applyVolume(pianoRef.current, volume);
    }
  }, [applyVolume, volume]);

  const onPlayPause = useCallback(async () => {
    if (!ready) return;
    await Tone.start();
    const audioContext = getAudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const midi = midiRef.current;
    if (!midi) return;

    try {
      const piano = await ensurePiano();
      pianoRef.current = piano;
      applyVolume(piano, volume);
      if (eventsRef.current.length === 0) {
        buildEvents(midi, tempo);
      }
    } catch (error) {
      resetPianoSoundfont();
      console.error("Piano soundfont failed to load:", error);
      setLoadError("Piano sound failed to load. Try again.");
      return;
    }

    if (playingRef.current) {
      pauseSelf();
      return;
    }

    let startAt = currentTime;
    if (ended || (duration > 0 && currentTime >= duration - 0.05)) {
      startAt = 0;
      setCurrentTime(0);
      setEnded(false);
    }

    resetOtherMidiPlayers(src);
    stopNotes();
    scheduleFrom(startAt, tempo);
    playingRef.current = true;
    setIsPlaying(true);
  }, [
    applyVolume,
    buildEvents,
    currentTime,
    duration,
    ended,
    ensurePiano,
    getAudioContext,
    pauseSelf,
    ready,
    scheduleFrom,
    src,
    stopNotes,
    tempo,
    volume
  ]);

  const onSeek = useCallback(
    (value: number) => {
      setCurrentTime(value);
      if (playingRef.current) {
        stopNotes();
        scheduleFrom(value, tempoRef.current);
      }
      if (duration > 0 && value < duration - 0.05) {
        setEnded(false);
      }
    },
    [duration, scheduleFrom, stopNotes]
  );

  const playbackFooter = (
    <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          Tempo
        </span>
        <input
          type="range"
          min={50}
          max={150}
          step={1}
          value={tempo}
          onChange={(event) => setTempo(Number(event.target.value))}
          className={canHumanize ? "w-20 min-w-0 sm:w-28" : "min-w-0 flex-1"}
          aria-label="Tempo"
        />
        <span className="shrink-0 min-w-[2.5rem] text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
          {tempo}%
        </span>
        {canHumanize ? (
          <div className="ml-auto flex shrink-0 items-center gap-2 pl-1 sm:gap-2.5 sm:pl-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Humanize
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={humanize}
              aria-label="Humanize dynamics"
              onClick={() => setHumanize(!humanize)}
              className={[
                "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
                humanize
                  ? "border-fuchsia-400/35 bg-fuchsia-500/15 dark:border-fuchsia-400/25 dark:bg-fuchsia-500/10"
                  : "border-black/10 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.06]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 dark:focus-visible:ring-white/20"
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full shadow-sm transition-transform",
                  humanize
                    ? "translate-x-4 bg-fuchsia-500/90 dark:bg-fuchsia-400/90"
                    : "translate-x-0 bg-zinc-400/90 dark:bg-zinc-500"
                ].join(" ")}
              />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div>
      <PlaybackShell
        label="MIDI"
        badge="piano"
        isPlaying={isPlaying}
        ended={ended}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        volumeMax={200}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
        onVolumeChange={setVolume}
        footer={playbackFooter}
        disabled={!ready}
      />
      {loadError ? <MidiLoadError message={loadError} /> : null}
    </div>
  );
}

function MidiLoadError({ message }: { message: string }) {
  return (
    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" role="status">
      {message}
    </p>
  );
}

export function MockupUnavailableBlurb() {
  return (
    <div className={cardClass}>
      <div className="mb-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">Mockup</div>
      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        No mockup is available for this example yet. Use the MIDI playback below to hear
        the example with a sampled piano soundfont.
      </p>
    </div>
  );
}
