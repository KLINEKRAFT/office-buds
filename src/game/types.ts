export type Dir = "up" | "down" | "left" | "right";
/**
 * Every character with art. This is a runtime list and the type is derived FROM it, not
 * the other way round: a hand-written union let a peer decoder go stale against it - it
 * clamped every arrival to one of the two characters that existed when it was written,
 * so three of the five turned up wearing somebody else's face over the network.
 */
export const CHARACTER_IDS = ["colin", "michael", "alexis", "melanie", "tiffany"] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === "string" && (CHARACTER_IDS as readonly string[]).includes(value);
}

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
  /**
   * Taken by the ceremony. Replicated rather than broadcast for the same reason
   * `carrying` is: everyone already receives it on the heartbeat, so a late joiner walks
   * into the grove and sees exactly who is still standing without anything being
   * replayed at them.
   */
  ascended: boolean;
  /**
   * Index into DOOMS of how this player died, or -1 if they are still with us.
   *
   * Replicated on the heartbeat for the same reason `carrying` and `ascended` are: the
   * killer broadcasts the deed once, only the victim's own client acts on it, and from
   * then on the fact rides the ordinary packet. Nobody can miss the event, the sprite
   * and the headline are derived from one number so they cannot disagree, and somebody
   * who arrives ten minutes later walks in on the bodies.
   */
  dead: number;
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
