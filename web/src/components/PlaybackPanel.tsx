"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";

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
  currentTime: number;
  duration: number;
  volume: number;
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
  currentTime,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
  footer,
  disabled = false
}: PlaybackShellProps) {
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
            {isPlaying ? "Pause" : "Play"}
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

          <div className="flex min-w-[8rem] items-center gap-2">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-500">Vol</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
              disabled={disabled}
              className="flex-1"
              aria-label="Volume"
            />
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
  const [volume, setVolume] = useState(0.9);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => setIsPlaying(false);

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
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const onPlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const onSeek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }, []);

  return (
    <PlaybackShell
      label="Mockup"
      badge={src.split(".").pop()?.toLowerCase() ?? "audio"}
      isPlaying={isPlaying}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      onPlayPause={onPlayPause}
      onSeek={onSeek}
      onVolumeChange={setVolume}
    />
  );
}

export function MidiPlayback({ src }: { src: string }) {
  const midiRef = useRef<Midi | null>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const partRef = useRef<Tone.Part | null>(null);
  const baseBpmRef = useRef(120);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [tempo, setTempo] = useState(100);

  const rebuildPart = useCallback(
    (midi: Midi, tempoPercent: number) => {
      partRef.current?.dispose();
      const synth = synthRef.current;
      if (!synth) return;

      const events: Array<{ time: number; note: string; duration: number; velocity: number }> = [];
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

      const part = new Tone.Part((time, value: { note: string; duration: number; velocity: number }) => {
        synth.triggerAttackRelease(
          value.note,
          value.duration,
          time,
          Math.max(0.05, value.velocity)
        );
      }, events).start(0);

      part.loop = false;
      partRef.current = part;

      const factor = tempoPercent / 100;
      Tone.Transport.bpm.value = baseBpmRef.current * factor;
      setDuration(midi.duration / factor);
    },
    []
  );

  const tempoRef = useRef(tempo);
  tempoRef.current = tempo;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setReady(false);
      partRef.current?.dispose();
      partRef.current = null;
      synthRef.current?.dispose();
      synthRef.current = null;

      const response = await fetch(src);
      const buffer = await response.arrayBuffer();
      const midi = new Midi(buffer);
      if (cancelled) return;

      const synth = new Tone.PolySynth(Tone.Synth, {
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.8 }
      }).toDestination();

      midiRef.current = midi;
      synthRef.current = synth;
      baseBpmRef.current = midi.header.tempos[0]?.bpm ?? 120;
      rebuildPart(midi, tempoRef.current);
      setCurrentTime(0);
      setReady(true);
    }

    void load();

    return () => {
      cancelled = true;
      Tone.Transport.stop();
      Tone.Transport.cancel();
      partRef.current?.dispose();
      synthRef.current?.dispose();
      partRef.current = null;
      synthRef.current = null;
      midiRef.current = null;
    };
  }, [rebuildPart, src]);

  useEffect(() => {
    const midi = midiRef.current;
    if (!midi || !ready) return;
    const wasPlaying = isPlaying;
    const position = Tone.Transport.seconds;
    rebuildPart(midi, tempo);
    Tone.Transport.seconds = Math.min(position, duration || midi.duration);
    setCurrentTime(Tone.Transport.seconds);
    if (wasPlaying) {
      Tone.Transport.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when user changes tempo
  }, [tempo]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!isPlaying) return;
      setCurrentTime(Tone.Transport.seconds);
    }, 100);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = Tone.gainToDb(volume);
    }
  }, [volume]);

  const onPlayPause = useCallback(async () => {
    if (!ready) return;
    await Tone.start();
    if (isPlaying) {
      Tone.Transport.pause();
      setIsPlaying(false);
    } else {
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [isPlaying, ready]);

  const onSeek = useCallback(
    (value: number) => {
      Tone.Transport.seconds = value;
      setCurrentTime(value);
    },
    []
  );

  const tempoFooter = (
    <div className="mt-4 flex items-center gap-3 border-t border-black/5 pt-4 dark:border-white/10">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        Tempo
      </span>
      <input
        type="range"
        min={50}
        max={150}
        step={1}
        value={tempo}
        onChange={(event) => setTempo(Number(event.target.value))}
        className="flex-1"
        aria-label="Tempo"
      />
      <span className="min-w-[3rem] text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
        {tempo}%
      </span>
    </div>
  );

  return (
    <PlaybackShell
      label="MIDI"
      badge="mid"
      isPlaying={isPlaying}
      currentTime={currentTime}
      duration={duration}
      volume={volume}
      onPlayPause={onPlayPause}
      onSeek={onSeek}
      onVolumeChange={setVolume}
      footer={tempoFooter}
      disabled={!ready}
    />
  );
}

export function MockupUnavailableBlurb() {
  return (
    <div className={cardClass}>
      <div className="mb-2 text-sm font-medium text-zinc-950 dark:text-zinc-100">Mockup</div>
      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        No mockup is available for this example yet. Use the MIDI playback below to hear
        the example with a basic synthesized sound.
      </p>
    </div>
  );
}
