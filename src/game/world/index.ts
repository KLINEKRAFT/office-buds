import type { RoomDef } from "./types";
import { office } from "./office";
import { grove } from "./grove";

/**
 * Room registry. Adding a place means writing one file and listing it here - the
 * renderer, collision and netcode do not change.
 */
export const ROOMS: Record<string, RoomDef> = {
  [office.id]: office,
  [grove.id]: grove,
};

export const DEFAULT_ROOM = office.id;

export function getRoom(id: string): RoomDef {
  return ROOMS[id] ?? ROOMS[DEFAULT_ROOM];
}

/**
 * Finds the room a spoken message sends everyone to, if any. Matching is on a
 * normalised copy so "Let's go outside!!" and "lets go outside" both work.
 */
export function matchSayTrigger(room: RoomDef, text: string) {
  const normal = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z' ?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const trigger of room.sayTriggers ?? []) {
    if (trigger.phrases.some((p) => normal.includes(p))) return trigger;
  }
  return null;
}

export type { RoomDef };
