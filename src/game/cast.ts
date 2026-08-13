import type { CharacterId } from "./types";

/**
 * Who's who.
 *
 * Names are tied to characters here rather than chosen at the door: you type your name
 * on the invite screen and you turn up as yourself. This is the one file to edit when a
 * new character is drawn - add the sprite via tools/build_sprites.py, then add a line
 * below.
 *
 * The manager is whoever sits behind the desk; everyone else arrives on the sofa.
 */

export type Role = "manager" | "visitor";

export interface CastMember {
  /** Canonical display name, shown on the name plate. */
  name: string;
  /** Extra spellings that resolve to this person. Matched case-insensitively. */
  aliases?: string[];
  character: CharacterId;
  role: Role;
}

export const CAST: CastMember[] = [
  { name: "COLIN", character: "colin", role: "manager" },
  { name: "MICHAEL", aliases: ["MIKE"], character: "michael", role: "visitor" },
];

/** Anyone not on the list still gets in, as a visitor wearing this character. */
const UNKNOWN_CHARACTER: CharacterId = "michael";

function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Resolves a typed name to a cast member. Unknown names are welcome - they just come in
 * as a visitor on the default sprite, so an invite never dead-ends on a typo.
 */
export function castFor(rawName: string): CastMember {
  const name = normalize(rawName);
  for (const member of CAST) {
    if (member.name === name) return member;
    if (member.aliases?.some((a) => normalize(a) === name)) return member;
  }
  return { name: name || "GUEST", character: UNKNOWN_CHARACTER, role: "visitor" };
}

/** True when the typed name matches somebody on the list, for entry-screen feedback. */
export function isKnownName(rawName: string): boolean {
  const name = normalize(rawName);
  return CAST.some(
    (m) => m.name === name || m.aliases?.some((a) => normalize(a) === name),
  );
}
