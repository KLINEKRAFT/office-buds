import type { RoomDef } from "./types";
import { office } from "./office";

/**
 * Room registry. Version 1 ships one office; conference room, break room, lobby and
 * the rest slot in here and everything else (rendering, collision, netcode) keeps
 * working unchanged.
 */
export const ROOMS: Record<string, RoomDef> = {
  [office.id]: office,
};

export const DEFAULT_ROOM = office.id;

export function getRoom(id: string): RoomDef {
  return ROOMS[id] ?? ROOMS[DEFAULT_ROOM];
}

export type { RoomDef };
