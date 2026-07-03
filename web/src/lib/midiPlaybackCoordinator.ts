type ResetHandler = () => void;

const players = new Map<string, ResetHandler>();

export function registerMidiPlayer(id: string, reset: ResetHandler): () => void {
  players.set(id, reset);
  return () => {
    players.delete(id);
  };
}

/** Reset seek/ended state on other players. Active player must call stopNotes() before scheduling. */
export function resetOtherMidiPlayers(activeId: string): void {
  for (const [id, reset] of players) {
    if (id !== activeId) {
      reset();
    }
  }
}
