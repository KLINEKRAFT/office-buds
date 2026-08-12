export type Dir = "up" | "down" | "left" | "right";
export type CharacterId = "colin" | "michael";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What one player looks like right now. This is also the movement network payload. */
export interface PlayerState {
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  /** Non-zero while a one-shot emote plays; see EMOTE_* in config. */
  emote: number;
}

export interface Player extends PlayerState {
  id: string;
  name: string;
  character: CharacterId;
  /** Smoothed position actually drawn; for the local player this tracks x/y exactly. */
  renderX: number;
  renderY: number;
  /** Seconds of animation elapsed, used to pick a frame. */
  animTime: number;
  emoteTime: number;
  bubble: Bubble | null;
  /** Wall-clock ms of the last packet, so we can drop players that vanish. */
  lastSeen: number;
}

export interface Bubble {
  text: string;
  lines: string[];
  born: number;
  duration: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
  /** True for messages this browser sent, so the history can highlight them. */
  own: boolean;
}
