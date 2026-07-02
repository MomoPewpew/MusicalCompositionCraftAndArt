import Soundfont, { type Player } from "soundfont-player";
import * as Tone from "tone";

const SOUNDFONT_BASE = "/soundfonts/FluidR3_GM/";

export type PianoSoundfont = {
  instrument: Player;
  masterGain: GainNode;
};

let loadPromise: Promise<PianoSoundfont> | null = null;

export function resetPianoSoundfont(): void {
  loadPromise = null;
}

async function createPianoSoundfont(): Promise<PianoSoundfont> {
  const audioContext = Tone.getContext().rawContext as AudioContext;
  const masterGain = audioContext.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(audioContext.destination);

  const instrument = await Soundfont.instrument(audioContext, "acoustic_grand_piano", {
    from: SOUNDFONT_BASE,
    destination: masterGain
  });

  return { instrument, masterGain };
}

export function loadPianoSoundfont(): Promise<PianoSoundfont> {
  const audioContext = Tone.getContext().rawContext as AudioContext;
  if (audioContext.state === "closed") {
    loadPromise = null;
  }

  if (!loadPromise) {
    loadPromise = createPianoSoundfont().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }

  return loadPromise;
}
