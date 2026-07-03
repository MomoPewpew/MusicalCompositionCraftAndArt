const VOLUME_KEY = "mcca:playback-volume";
const TEMPO_KEY = "mcca:midi-tempo";

const DEFAULT_VOLUME = 100;
const DEFAULT_TEMPO = 100;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function readGlobalVolume(): number {
  if (!canUseStorage()) return DEFAULT_VOLUME;
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const value = Number(raw);
    if (!Number.isFinite(value)) return DEFAULT_VOLUME;
    return Math.min(200, Math.max(0, Math.round(value)));
  } catch {
    return DEFAULT_VOLUME;
  }
}

type VolumeListener = (volume: number) => void;
const volumeListeners = new Set<VolumeListener>();

export function writeGlobalVolume(volume: number): void {
  if (!canUseStorage()) return;
  const clamped = Math.min(200, Math.max(0, Math.round(volume)));
  try {
    localStorage.setItem(VOLUME_KEY, String(clamped));
  } catch {
    // ignore quota errors and private browsing
  }
  for (const listener of volumeListeners) {
    listener(clamped);
  }
}

export function subscribeGlobalVolume(listener: VolumeListener): () => void {
  volumeListeners.add(listener);
  return () => {
    volumeListeners.delete(listener);
  };
}

type TempoMap = Record<string, number>;

function readTempoMap(): TempoMap {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(TEMPO_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as TempoMap;
  } catch {
    return {};
  }
}

export function readMidiTempo(src: string): number {
  const value = readTempoMap()[src];
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TEMPO;
  return Math.min(150, Math.max(50, Math.round(value)));
}

export function writeMidiTempo(src: string, tempo: number): void {
  if (!canUseStorage()) return;
  try {
    const map = readTempoMap();
    map[src] = Math.min(150, Math.max(50, Math.round(tempo)));
    localStorage.setItem(TEMPO_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors and private browsing
  }
}

const HUMANIZE_KEY = "mcca:midi-humanize";
const DEFAULT_HUMANIZE = true;

export function readMidiHumanize(): boolean {
  if (!canUseStorage()) return DEFAULT_HUMANIZE;
  try {
    const raw = localStorage.getItem(HUMANIZE_KEY);
    if (raw === null) return DEFAULT_HUMANIZE;
    return raw === "1" || raw === "true";
  } catch {
    return DEFAULT_HUMANIZE;
  }
}

type HumanizeListener = (enabled: boolean) => void;
const humanizeListeners = new Set<HumanizeListener>();

export function writeMidiHumanize(enabled: boolean): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(HUMANIZE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore quota errors and private browsing
  }
  for (const listener of humanizeListeners) {
    listener(enabled);
  }
}

export function subscribeMidiHumanize(listener: HumanizeListener): () => void {
  humanizeListeners.add(listener);
  return () => {
    humanizeListeners.delete(listener);
  };
}
