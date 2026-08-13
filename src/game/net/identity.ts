import { isCharacterId, type CharacterId, type Dir, type PlayerState } from "../types";
import type { NetIdentity } from "./types";

/**
 * Turns whatever a peer announced into a NetIdentity we are willing to draw.
 *
 * Shared by both transports on purpose. This decoding used to live inline in the
 * Supabase driver, written when the cast was two people, and it clamped anything that
 * was not "michael" to "colin" - so over a real connection Alexis, Melanie and Tiffany
 * all arrived wearing Colin's sprite while looking correct on their own screen. The
 * same-browser driver did not share the code and did not have the bug, which is exactly
 * why every test passed.
 *
 * One decoder, checked against the real character list, testable without a socket.
 */

/** Somebody announcing a character we have no art for still gets in, as this. */
export const FALLBACK_CHARACTER: CharacterId = "michael";

export const FALLBACK_NAME = "BUD";
const MAX_NAME = 12;

const DIRS: readonly Dir[] = ["up", "down", "left", "right"];

/**
 * Turns a movement packet off the wire into a PlayerState.
 *
 * Shared for the same reason decodeIdentity is. Both transports used to pick this apart
 * field by field, in two places, which is precisely how the character bug happened: a
 * field was added, one copy learned about it, and the transport nobody could test from
 * a test kept sending everybody the default. Adding a field is now one edit in one file
 * with one test over it.
 *
 * Every field is defaulted rather than trusted. A peer on an older build simply does not
 * send the newest one, and the honest reading of "absent" is "not doing that".
 */
export function decodeMove(raw: Record<string, unknown> | undefined | null): PlayerState | null {
  if (!raw || typeof raw.x !== "number" || typeof raw.y !== "number") return null;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;
  return {
    x: raw.x,
    y: raw.y,
    dir: DIRS.includes(raw.dir as Dir) ? (raw.dir as Dir) : "down",
    moving: Boolean(raw.moving),
    emote: typeof raw.emote === "string" ? raw.emote : "",
    room: typeof raw.room === "string" ? raw.room : "office",
    carrying: typeof raw.carrying === "number" ? raw.carrying : -1,
    ascended: Boolean(raw.ascended),
    dead: typeof raw.dead === "number" ? raw.dead : -1,
  };
}

export function decodeIdentity(
  id: string,
  meta: { name?: unknown; character?: unknown } | undefined | null,
): NetIdentity {
  const name = typeof meta?.name === "string" ? meta.name.trim() : "";
  return {
    id,
    name: (name || FALLBACK_NAME).slice(0, MAX_NAME),
    character: isCharacterId(meta?.character) ? meta.character : FALLBACK_CHARACTER,
  };
}
