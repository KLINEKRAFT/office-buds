import type { CharacterId } from "../types";
import { LocalNet } from "./local";
import { SupabaseNet } from "./supabase";
import type { Net, NetStatus } from "./types";

export type { Net, NetHandlers, NetIdentity, NetStatus } from "./types";

export function realtimeConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Picks a transport:
 *   ?net=local            - force the same-browser driver, for testing
 *   Supabase env vars set - real invite-link multiplayer
 *   neither               - fall back to the same-browser driver, so a missing env var
 *                           still leaves a playable office rather than an error screen
 */
export function createNet(
  room: string,
  identity: { id: string; name: string; character: CharacterId },
): Net {
  const forced =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("net") === "local";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (forced || !url || !key) return new LocalNet(room, identity);
  return new SupabaseNet(url, key, room, identity);
}

export const STATUS_LABEL: Record<NetStatus, string> = {
  connecting: "CONNECTING",
  online: "ONLINE",
  local: "SAME DEVICE",
  offline: "SOLO",
  error: "OFFLINE",
};
