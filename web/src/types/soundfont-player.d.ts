declare module "soundfont-player" {
  export type Player = {
    play: (
      note: string,
      when?: number,
      options?: { duration?: number; gain?: number; attack?: number }
    ) => string | string[];
    stop: (when?: number, ids?: string | string[]) => void;
  };

  export function instrument(
    ac: AudioContext,
    name: string,
    options?: {
      from?: string;
      destination?: AudioNode;
      soundfont?: string;
      format?: "ogg" | "mp3";
    }
  ): Promise<Player>;

  const Soundfont: {
    instrument: typeof instrument;
  };

  export default Soundfont;
}
