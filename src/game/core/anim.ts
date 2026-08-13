import { EMOTE_WAVE, FRAME, WALK_FPS_AT_FULL_SPEED, WALK_SPEED } from "../config";
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

  if (player.emote === EMOTE_WAVE && meta.clips.wave) {
    clipName = "wave";
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
  const index = clip.loop ? ((raw % clip.count) + clip.count) % clip.count : Math.min(raw, clip.count - 1);
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

/** True once a non-looping emote has played out. */
export function emoteFinished(meta: CharacterMeta, emote: number, time: number): boolean {
  if (emote !== EMOTE_WAVE) return true;
  const clip = meta.clips.wave;
  if (!clip) return true;
  return time >= clip.count / clip.fps;
}
