import type { CharacterId, PlayerState } from "../types";

export interface NetIdentity {
  id: string;
  name: string;
  character: CharacterId;
}

/**
 * "local" means the same-browser fallback is running because no realtime backend is
 * configured. It is distinct from "online" on purpose: both find peers and both report
 * a player count, so without separating them there is no way to tell from the screen
 * whether an invite link will actually reach anybody.
 */
export type NetStatus = "connecting" | "online" | "local" | "offline" | "error";

export interface NetHandlers {
  /** Fired for every peer already present and for each new arrival. */
  onJoin(peer: NetIdentity): void;
  onLeave(id: string): void;
  onMove(id: string, state: PlayerState): void;
  onChat(id: string, text: string, at: number): void;
  /** Somebody invited the room somewhere; everyone goes. */
  onGo(id: string, room: string, spawn: number, announce: string): void;
  onStatus(status: NetStatus, detail?: string): void;
}

export interface Net {
  readonly id: string;
  connect(handlers: NetHandlers): Promise<void>;
  disconnect(): void;
  /** Lossy and frequent. Implementations may drop these under load. */
  sendMove(state: PlayerState): void;
  /** Must not be dropped. */
  sendChat(text: string): void;
  /** Move everybody to another room. Must not be dropped. */
  sendGo(room: string, spawn: number, announce: string): void;
}
