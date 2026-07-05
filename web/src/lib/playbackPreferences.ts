const LEGACY_VOLUME_KEY = "mcca:playback-volume";
const MIDI_VOLUME_KEY = "mcca:midi-volume";
const MOCKUP_VOLUME_KEY = "mcca:mockup-volume";
const TEMPO_KEY = "mcca:midi-tempo";

const DEFAULT_VOLUME = 100;
const DEFAULT_TEMPO = 100;
const VOLUME_MAX = 200;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function clampVolume(value: number): number {
  return Math.min(VOLUME_MAX, Math.max(0, Math.round(value)));
}

function readVolumeKey(key: string): number {
  if (!canUseStorage()) return DEFAULT_VOLUME;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return DEFAULT_VOLUME;
    const value = Number(raw);
    if (!Number.isFinite(value)) return DEFAULT_VOLUME;
    return clampVolume(value);
  } catch {
    return DEFAULT_VOLUME;
  }
}

function writeVolumeKey(key: string, volume: number): void {
  if (!canUseStorage()) return;
  const clamped = clampVolume(volume);
  try {
    localStorage.setItem(key, String(clamped));
  } catch {
    // ignore quota errors and private browsing
  }
}

function migrateLegacyVolume(): void {
  if (!canUseStorage()) return;
  try {
    const legacy = localStorage.getItem(LEGACY_VOLUME_KEY);
    if (legacy === null) return;
    if (localStorage.getItem(MIDI_VOLUME_KEY) === null) {
      localStorage.setItem(MIDI_VOLUME_KEY, legacy);
    }
    if (localStorage.getItem(MOCKUP_VOLUME_KEY) === null) {
      localStorage.setItem(MOCKUP_VOLUME_KEY, legacy);
    }
    localStorage.removeItem(LEGACY_VOLUME_KEY);
  } catch {
    // ignore
  }
}

type VolumeListener = (volume: number) => void;

function createVolumePreference(storageKey: string) {
  const listeners = new Set<VolumeListener>();

  function read(): number {
    migrateLegacyVolume();
    return readVolumeKey(storageKey);
  }

  function write(volume: number): void {
    const clamped = clampVolume(volume);
    writeVolumeKey(storageKey, clamped);
    for (const listener of listeners) {
      listener(clamped);
    }
  }

  function subscribe(listener: VolumeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { read, write, subscribe };
}

const midiVolumePreference = createVolumePreference(MIDI_VOLUME_KEY);
const mockupVolumePreference = createVolumePreference(MOCKUP_VOLUME_KEY);

export const readMidiVolume = midiVolumePreference.read;
export const writeMidiVolume = midiVolumePreference.write;
export const subscribeMidiVolume = midiVolumePreference.subscribe;

export const readMockupVolume = mockupVolumePreference.read;
export const writeMockupVolume = mockupVolumePreference.write;
export const subscribeMockupVolume = mockupVolumePreference.subscribe;

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
