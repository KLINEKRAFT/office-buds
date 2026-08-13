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
 * Which seat you arrive in. This is only ever about furniture - it is not a job title
 * and is never shown to anyone.
 */
export type SeatKind = "desk" | "sofa";

export interface CastMember {
  /** Canonical display name, shown on the name plate. */
  name: string;
  /** Extra spellings that resolve to this person. Matched case-insensitively. */
  aliases?: string[];
  character: CharacterId;
  seat: SeatKind;
}

export const CAST: CastMember[] = [
  { name: "COLIN", character: "colin", seat: "desk" },
  { name: "MICHAEL", aliases: ["MIKE"], character: "michael", seat: "sofa" },
  { name: "ALEXIS", aliases: ["LEX"], character: "alexis", seat: "sofa" },
  { name: "MELANIE", aliases: ["MEL"], character: "melanie", seat: "sofa" },
  { name: "TIFFANY", aliases: ["TIFF"], character: "tiffany", seat: "sofa" },
];

/** Anyone not on the list still gets in, as a guest wearing this character. */
const UNKNOWN_CHARACTER: CharacterId = "michael";

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
  return { name: name || "GUEST", character: UNKNOWN_CHARACTER, seat: "sofa" };
}

/** True when the typed name matches somebody on the list, for entry-screen feedback. */
export function isKnownName(rawName: string): boolean {
  const name = normalize(rawName);
  return CAST.some(
    (m) => m.name === name || m.aliases?.some((a) => normalize(a) === name),
  );
}
