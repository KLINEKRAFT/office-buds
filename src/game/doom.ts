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
  /**
   * Shown on the button. Nine characters is what fits: the tray is a grid of 68px
   * buttons at 8px, and "EMBARRASSED" came out as "EMBARRASSE". Checked in the tests,
   * because a clipped word is the kind of thing you stop seeing after a day.
   */
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
  { short: "EXCEL", label: "WAS REPLACED BY A SPREADSHEET" },
  { short: "TERMS", label: "READ THE FULL TERMS AND CONDITIONS" },
  { short: "STAIRS", label: "TOOK THE STAIRS" },
  { short: "VENDING", label: "LOST EVERYTHING TO THE VENDING MACHINE" },
  { short: "SHAME", label: "DIED OF EMBARRASSMENT" },
  { short: "BOREDOM", label: "DIED OF BOREDOM, IN THE PRINT ROOM, AT 3PM" },
  { short: "COMBUSTED", label: "SPONTANEOUSLY COMBUSTED" },
  { short: "ON HOLD", label: "DIED OF OLD AGE ON HOLD" },
];

/**
 * The effect string a killer broadcasts. Decoded by everyone, acted on by the victim.
 *
 * `doom:<cause>:<weapon>:<victim id>`. The id goes LAST because it is the only opaque
 * part - a cause is a number and a weapon is a sprite name, so both are known to be
 * colon-free, and putting the unknown at the end means the parse never has to guess
 * where it ends.
 */
export function doomEffect(victimId: string, cause: number, weapon = ""): string {
  return `doom:${cause}:${weapon}:${victimId}`;
}

export function reviveEffect(victimId: string): string {
  return `undoom:${victimId}`;
}

/** Parses "doom:<cause>:<weapon>:<id>", or null if it is not one. */
export function parseDoom(
  effect: string,
): { id: string; cause: number; weapon: string } | null {
  if (!effect.startsWith("doom:")) return null;
  const rest = effect.slice("doom:".length);
  const first = rest.indexOf(":");
  if (first <= 0) return null;
  const second = rest.indexOf(":", first + 1);
  if (second < 0) return null;
  const cause = Number(rest.slice(0, first));
  if (!Number.isInteger(cause) || cause < 0 || cause >= DOOMS.length) return null;
  const id = rest.slice(second + 1);
  if (!id) return null;
  return { id, cause, weapon: rest.slice(first + 1, second) };
}

export function parseRevive(effect: string): string | null {
  return effect.startsWith("undoom:") ? effect.slice("undoom:".length) : null;
}

/**
 * "MICHAEL WAS EATEN BY THE PRINTER", or - if the killer had something in their hands -
 * "MICHAEL WAS BEATEN TO DEATH WITH THE PHOTOCOPIER".
 *
 * The weapon wins because it is the funnier and truer account: everybody watching saw
 * somebody walk over holding a photocopier, and a headline about the annual review would
 * be describing a different event.
 */
export function headline(name: string, cause: number, weapon = ""): string {
  const held = weapon.replace(/_/g, " ").trim().toUpperCase();
  if (held) return `${name} WAS BEATEN TO DEATH WITH THE ${held}`;
  return `${name} ${DOOMS[cause]?.label ?? "IS NO LONGER WITH US"}`;
}

/** A cause picked from the name and the moment, for "kill michael" typed into chat. */
export function anyDoom(seed: number): number {
  return Math.abs(seed) % DOOMS.length;
}
