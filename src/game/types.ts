export type Dir = "up" | "down" | "left" | "right";
export type CharacterId = "colin" | "michael" | "alexis" | "melanie" | "tiffany";

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
  /**
   * Name of a one-shot clip that is playing, or "" for none. A name rather than an
   * enum because the available emotes differ per character - Colin has his laptop,
   * Michael does not - so the set is whatever the atlas manifest happens to hold.
   */
  emote: string;
  /** Which room this player is standing in. Players elsewhere are not drawn. */
  room: string;
  /**
   * Index into the room's prop list of the thing this player is holding, or -1.
   *
   * The whole of the world's "what has been picked up" state lives in this one
   * replicated field, which is what makes it impossible to desync: a takeable prop is
   * drawn unless somebody in the room is carrying it, and everyone already receives
   * everyone's carrying value on the movement heartbeat. Nothing has to be replayed for
   * a late joiner and no separate take/drop event can be missed.
   */
  carrying: number;
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
