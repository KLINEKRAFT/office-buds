import { isCharacterId, type CharacterId } from "../types";
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
