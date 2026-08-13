import { FRAME, WALK_FPS_AT_FULL_SPEED, WALK_SPEED } from "../config";
import type { CharacterMeta } from "./assets";
import type { Dir, Player } from "../types";

export interface Pose {
  /** Source rect in the character atlas. */
  sx: number;
  sy: number;
  /** Mirror horizontally (the side walk is authored facing right only). */
  flip: boolean;
  /** Extra vertical offset for the breathing bob on single-frame idles. */
  bob: number;
}

function suffix(dir: Dir): "up" | "down" | "side" {
  if (dir === "up") return "up";
  if (dir === "down") return "down";
  return "side";
}

/**
 * Picks the clip and frame for a player. Emotes win over everything, then walking,
 * then idling. Side-facing clips are authored walking right and mirrored for left.
 */
export function poseFor(player: Player, meta: CharacterMeta, speed: number): Pose {
  const flip = player.dir === "left";
  let clipName: string;
  let time: number;

  if (player.emote && meta.clips[player.emote]) {
    clipName = player.emote;
    time = player.emoteTime;
  } else if (player.moving) {
    clipName = `walk_${suffix(player.dir)}`;
    time = player.animTime;
  } else {
    clipName = `idle_${suffix(player.dir)}`;
    time = player.animTime;
  }

  const clip = meta.clips[clipName] ?? meta.clips.idle_down;

  // Match stride to actual speed so the feet do not skate at half-joystick.
  let fps = clip.fps;
  if (player.moving && clipName.startsWith("walk")) {
    fps = WALK_FPS_AT_FULL_SPEED * Math.max(0.35, speed / WALK_SPEED);
  }

  const raw = Math.floor(time * fps);
  const index = clip.loop
    ? ((raw % clip.count) + clip.count) % clip.count
    : Math.min(raw, clip.count - 1);
  const frame = clip.start + index;

  // Single-frame idles get a gentle 1px rise so nobody looks frozen.
  const bob = !player.moving && clip.count === 1 && Math.sin(time * 2.4) > 0.35 ? -1 : 0;

  return {
    sx: (frame % meta.cols) * FRAME,
    sy: Math.floor(frame / meta.cols) * FRAME,
    flip,
    bob,
  };
}

/**
 * Emotes that hold on their last frame - the laptop, say - stay until the player moves
 * or triggers something else, rather than snapping back after a second. "lift" ends with
 * both arms raised overhead, which has to persist or it reads as a flinch.
 */
const HOLD_FOREVER = new Set(["laptop", "lift"]);

export function emoteFinished(meta: CharacterMeta, emote: string, time: number): boolean {
  if (!emote) return true;
  const clip = meta.clips[emote];
  if (!clip) return true;
  if (HOLD_FOREVER.has(emote)) return false;
  return time >= clip.count / clip.fps;
}

/** Emote clip names this character actually has art for. */
export function availableEmotes(meta: CharacterMeta, candidates: string[]): string[] {
  return candidates.filter((c) => Boolean(meta.clips[c]));
}
