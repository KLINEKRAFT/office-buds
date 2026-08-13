import { FALLBACK_CHARACTER } from "./net/identity";
import type { CharacterId } from "./types";

/**
 * Who's who.
 *
 * Names are tied to characters here rather than chosen at the door: you type your first
 * name on the invite screen and you turn up as yourself. This is the one file to edit
 * when a new character is drawn - add the sheets via tools/build_sprites.py, then add a
 * line below.
 */

/**
 * Which place you arrive in. Not a job title and never shown to anyone - it only says
 * which spot a room puts you in, whether that is the desk in the office or the stone at
 * the head of the circle in the grove.
 */
export type SeatKind = "lead" | "guest";

export interface CastMember {
  /** Canonical display name, shown on the name plate. */
  name: string;
  /** Extra spellings that resolve to this person. Matched case-insensitively. */
  aliases?: string[];
  character: CharacterId;
  seat: SeatKind;
}

export const CAST: CastMember[] = [
  { name: "COLIN", character: "colin", seat: "lead" },
  { name: "MICHAEL", aliases: ["MIKE"], character: "michael", seat: "guest" },
  { name: "ALEXIS", aliases: ["LEX"], character: "alexis", seat: "guest" },
  { name: "MELANIE", aliases: ["MEL"], character: "melanie", seat: "guest" },
  { name: "TIFFANY", aliases: ["TIFF"], character: "tiffany", seat: "guest" },
];

/** Anyone not on the list still gets in, as a guest wearing this character. */
const UNKNOWN_CHARACTER: CharacterId = FALLBACK_CHARACTER;

/** First name only - "Colin Kline" and "colin" are the same person walking in. */
function normalize(raw: string): string {
  return raw.trim().toUpperCase().split(/[\s.]+/)[0] ?? "";
}

/**
 * Resolves a typed name to a cast member. Unknown names are welcome - they just come in
 * on the default sprite, so an invite never dead-ends on a typo.
 */
export function castFor(rawName: string): CastMember {
  const name = normalize(rawName);
  for (const member of CAST) {
    if (member.name === name) return member;
    if (member.aliases?.some((a) => normalize(a) === name)) return member;
  }
  return { name: name || "GUEST", character: UNKNOWN_CHARACTER, seat: "guest" };
}

/** True when the typed name matches somebody on the list, for entry-screen feedback. */
export function isKnownName(rawName: string): boolean {
  const name = normalize(rawName);
  return CAST.some(
    (m) => m.name === name || m.aliases?.some((a) => normalize(a) === name),
  );
}
