"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";

import { loadPianoSoundfont, resetPianoSoundfont } from "@/lib/pianoSoundfont";
import {
  readGlobalVolume,
  readMidiTempo,
  writeGlobalVolume,
  writeMidiTempo
} from "@/lib/playbackPreferences";

const MIDI_GAIN_BOOST = 2;

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
  const [volume, setVolumeState] = useState(90);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    setVolumeState(Math.min(readGlobalVolume(), 100));
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(value)));
    setVolumeState(clamped);
    writeGlobalVolume(clamped);
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
      audioRef.current.volume = volume / 100;
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
      onPlayPause={onPlayPause}
      onSeek={onSeek}
      onVolumeChange={setVolume}
    />
  );
}

export function MidiPlayback({ src }: { src: string }) {
  const midiRef = useRef<Midi | null>(null);
  const pianoRef = useRef<Awaited<ReturnType<typeof loadPianoSoundfont>> | null>(null);
  const partRef = useRef<Tone.Part | null>(null);
  const baseBpmRef = useRef(120);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [tempo, setTempoState] = useState(100);
  const [ended, setEnded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tempoRef = useRef(100);

  useEffect(() => {
    setVolumeState(readGlobalVolume());
  }, []);

  useEffect(() => {
    const savedTempo = readMidiTempo(src);
    setTempoState(savedTempo);
    tempoRef.current = savedTempo;
  }, [src]);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.min(200, Math.max(0, Math.round(value)));
    setVolumeState(clamped);
    writeGlobalVolume(clamped);
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

  const rebuildPart = useCallback(
    (midi: Midi, tempoPercent: number) => {
      partRef.current?.dispose();
      const piano = pianoRef.current;
      if (!piano) return;

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
        piano.instrument.play(value.note, time, {
          duration: value.duration,
          gain: Math.max(0.05, value.velocity)
        });
      }, events).start(0);

      part.loop = false;
      partRef.current = part;

      const factor = tempoPercent / 100;
      Tone.Transport.bpm.value = baseBpmRef.current * factor;
      setDuration(midi.duration / factor);
    },
    []
  );

  tempoRef.current = tempo;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setReady(false);
      setLoadError(null);
      partRef.current?.dispose();
      partRef.current = null;
      pianoRef.current?.instrument.stop();
      pianoRef.current = null;
      midiRef.current = null;

      try {
        const midiResponse = await fetch(src);
        if (!midiResponse.ok) {
          throw new Error(`MIDI fetch failed (${midiResponse.status})`);
        }

        const buffer = await midiResponse.arrayBuffer();
        const midi = new Midi(buffer);
        if (cancelled) return;

        midiRef.current = midi;
        baseBpmRef.current = midi.header.tempos[0]?.bpm ?? 120;
        const factor = tempoRef.current / 100;
        setDuration(midi.duration / factor);
        setCurrentTime(0);
        setEnded(false);
        setReady(true);

        void ensurePiano()
          .then((piano) => {
            if (cancelled || midiRef.current !== midi) return;
            applyVolume(piano, volume);
            rebuildPart(midi, tempoRef.current);
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
      Tone.Transport.stop();
      Tone.Transport.cancel();
      partRef.current?.dispose();
      pianoRef.current?.instrument.stop();
      partRef.current = null;
      pianoRef.current = null;
      midiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volume applied via separate effect
  }, [applyVolume, ensurePiano, rebuildPart, src]);

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
      const time = Tone.Transport.seconds;
      setCurrentTime(time);
      if (duration > 0 && time >= duration - 0.05) {
        Tone.Transport.pause();
        Tone.Transport.seconds = duration;
        setCurrentTime(duration);
        setIsPlaying(false);
        setEnded(true);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [duration, isPlaying]);

  useEffect(() => {
    if (pianoRef.current) {
      applyVolume(pianoRef.current, volume);
    }
  }, [applyVolume, volume]);

  const onPlayPause = useCallback(async () => {
    if (!ready) return;
    await Tone.start();
    const audioContext = Tone.getContext().rawContext as AudioContext;
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const midi = midiRef.current;
    if (!midi) return;

    try {
      const piano = await ensurePiano();
      applyVolume(piano, volume);
      if (!partRef.current) {
        rebuildPart(midi, tempo);
      }
    } catch (error) {
      resetPianoSoundfont();
      console.error("Piano soundfont failed to load:", error);
      setLoadError("Piano sound failed to load. Try again.");
      return;
    }
    if (isPlaying) {
      Tone.Transport.pause();
      setIsPlaying(false);
      return;
    }
    if (ended || (duration > 0 && currentTime >= duration - 0.05)) {
      const midi = midiRef.current;
      if (midi) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        pianoRef.current?.instrument.stop();
        rebuildPart(midi, tempo);
      }
      Tone.Transport.seconds = 0;
      setCurrentTime(0);
      setEnded(false);
    }
    Tone.Transport.start();
    setIsPlaying(true);
  }, [applyVolume, currentTime, duration, ended, ensurePiano, isPlaying, ready, rebuildPart, tempo, volume]);

  const onSeek = useCallback(
    (value: number) => {
      Tone.Transport.seconds = value;
      setCurrentTime(value);
      if (duration > 0 && value < duration - 0.05) {
        setEnded(false);
      }
    },
    [duration]
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
        footer={tempoFooter}
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
