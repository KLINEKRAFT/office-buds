import type { CharacterId, PlayerState } from "../types";

export interface NetIdentity {
  id: string;
  name: string;
  character: CharacterId;
}

export type NetStatus = "connecting" | "online" | "offline" | "error";

export interface NetHandlers {
  /** Fired for every peer already present and for each new arrival. */
  onJoin(peer: NetIdentity): void;
  onLeave(id: string): void;
  onMove(id: string, state: PlayerState): void;
  onChat(id: string, text: string, at: number): void;
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
}
