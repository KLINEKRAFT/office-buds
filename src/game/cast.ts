import { FALLBACK_CHARACTER } from "./net/identity";
import { CHARACTER_IDS, type CharacterId } from "./types";

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

/**
 * Which character a name we do not know borrows.
 *
 * It used to be one fixed fallback, so every guest in the building was Michael - which
 * is how Jenni turned up looking like Michael. Picking from the name instead means an
 * unfamiliar name gets somebody who is at least not always the same somebody, and gets
 * the SAME one every time they come back, which is what makes it read as a person
 * rather than a glitch.
 *
 * This is a stopgap and should stay one: the real fix for any given name is a sheet of
 * their own and a line in CAST below.
 */
function borrowedCharacter(name: string): CharacterId {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  return CHARACTER_IDS[Math.abs(h) % CHARACTER_IDS.length] ?? FALLBACK_CHARACTER;
}

/** First name only - "Colin Kline" and "colin" are the same person walking in. */
function normalize(raw: string): string {
  return raw.trim().toUpperCase().split(/[\s.]+/)[0] ?? "";
}

/**
 * Resolves a typed name to a cast member. Unknown names are welcome - they borrow a
 * character, so an invite never dead-ends on a typo or on somebody new.
 */
export function castFor(rawName: string): CastMember {
  const name = normalize(rawName);
  for (const member of CAST) {
    if (member.name === name) return member;
    if (member.aliases?.some((a) => normalize(a) === name)) return member;
  }
  return { name: name || "GUEST", character: borrowedCharacter(name), seat: "guest" };
}

/** True when the typed name matches somebody on the list, for entry-screen feedback. */
export function isKnownName(rawName: string): boolean {
  const name = normalize(rawName);
  return CAST.some(
    (m) => m.name === name || m.aliases?.some((a) => normalize(a) === name),
  );
}
