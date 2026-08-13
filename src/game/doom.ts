/**
 * Ways to die.
 *
 * You can do this to anybody in the room, and anybody can do it to you. The victim goes
 * down where they stand, everyone gets the headline, and getting up is one tap - which
 * is the whole reason this is funny rather than annoying. Nobody is ever locked out of
 * the game they came here to play.
 *
 * HOW IT TRAVELS. The killer broadcasts an effect naming a victim and a cause. Only the
 * victim's own client acts on it, setting `dead` on itself; that field then rides the
 * ordinary movement heartbeat like `carrying` and `ascended` do, so every screen agrees
 * about who is on the floor without anything being replayed, and somebody who walks in
 * ten minutes later sees the bodies. The headline is derived from the same index, so it
 * cannot disagree with the sprite.
 *
 * THE LIST. Editing it is one line, and the index is what crosses the wire - so adding
 * to the END is free, and reordering it will have somebody dying of the wrong thing on
 * a client that has not reloaded. Add, do not rearrange.
 */

export interface Doom {
  /** Shown to everyone, after the victim's name: "MICHAEL <label>". */
  label: string;
  /** Shown on the button. Kept short - it sits in a tray on a phone. */
  short: string;
}

export const DOOMS: Doom[] = [
  { short: "MEETING", label: "DIED IN A MEETING THAT COULD HAVE BEEN AN EMAIL" },
  { short: "REPLY ALL", label: "REPLIED ALL AND COULD NOT LIVE WITH IT" },
  { short: "LIFT", label: "IS STILL WAITING FOR THE LIFT" },
  { short: "PRINTER", label: "WAS EATEN BY THE PRINTER" },
  { short: "COFFEE", label: "DRANK THE POT NOBODY HAD CHANGED SINCE TUESDAY" },
  { short: "SYNERGY", label: "WAS SYNERGISED TO DEATH" },
  { short: "REVIEW", label: "DID NOT SURVIVE THE ANNUAL REVIEW" },
  { short: "SOFA", label: "WAS ABSORBED BY THE HANG OUT ROOM SOFA" },
  { short: "SPREADSHEET", label: "WAS REPLACED BY A SPREADSHEET" },
  { short: "TERMS", label: "READ THE FULL TERMS AND CONDITIONS" },
  { short: "STAIRS", label: "TOOK THE STAIRS" },
  { short: "VENDING", label: "LOST EVERYTHING TO THE VENDING MACHINE" },
  { short: "EMBARRASSED", label: "DIED OF EMBARRASSMENT" },
  { short: "BOREDOM", label: "DIED OF BOREDOM, IN THE PRINT ROOM, AT 3PM" },
  { short: "COMBUSTED", label: "SPONTANEOUSLY COMBUSTED" },
  { short: "ON HOLD", label: "DIED OF OLD AGE ON HOLD" },
];

/** The effect string a killer broadcasts. Decoded by everyone, acted on by the victim. */
export function doomEffect(victimId: string, cause: number): string {
  return `doom:${victimId}:${cause}`;
}

export function reviveEffect(victimId: string): string {
  return `undoom:${victimId}`;
}

/** Parses "doom:<id>:<n>", or null if it is not one. */
export function parseDoom(effect: string): { id: string; cause: number } | null {
  if (!effect.startsWith("doom:")) return null;
  const rest = effect.slice("doom:".length);
  const split = rest.lastIndexOf(":");
  if (split <= 0) return null;
  const cause = Number(rest.slice(split + 1));
  if (!Number.isInteger(cause) || cause < 0 || cause >= DOOMS.length) return null;
  return { id: rest.slice(0, split), cause };
}

export function parseRevive(effect: string): string | null {
  return effect.startsWith("undoom:") ? effect.slice("undoom:".length) : null;
}

/** "MICHAEL WAS EATEN BY THE PRINTER". */
export function headline(name: string, cause: number): string {
  return `${name} ${DOOMS[cause]?.label ?? "IS NO LONGER WITH US"}`;
}

/** A cause picked from the name and the moment, for "kill michael" typed into chat. */
export function anyDoom(seed: number): number {
  return Math.abs(seed) % DOOMS.length;
}
