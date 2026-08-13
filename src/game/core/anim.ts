import { FRAME, WALK_FPS_AT_FULL_SPEED, WALK_SPEED } from "../config";
import type { CharacterMeta } from "./assets";
import { frameRect, procPose, procSeconds, resolveEmote } from "./emotes";
import type { Dir, Player } from "../types";

export interface Pose {
  /** Source rect in the character atlas. */
  sx: number;
  sy: number;
  /** Mirror horizontally (the side walk is authored facing right only). */
  flip: boolean;
  /** Vertical offset: the breathing bob on single-frame idles, or a hop leaving the floor. */
  bob: number;
  /** Horizontal offset, used by the synthesised emotes that sway or jitter. */
  dx: number;
  /** Radians about the feet. Only a faint uses it. */
  rot: number;
}

/** Far enough into the faint that the topple has finished and it is just holding. */
const DEATH_POSE_TIME = 2;

function suffix(dir: Dir): "up" | "down" | "side" {
  if (dir === "up") return "up";
  if (dir === "down") return "down";
  return "side";
}

/**
 * Picks the clip and frame for a player. Emotes win over everything, then carrying,
 * then walking, then idling. Side-facing clips are authored walking right and mirrored
 * for left.
 *
 * An emote is resolved through `resolveEmote`, so the same button plays a hand-drawn
 * clip for whoever has one and a synthesised stand-in for whoever does not.
 */
export function poseFor(player: Player, meta: CharacterMeta, speed: number): Pose {
  const flip = player.dir === "left";
  let clipName: string;
  let time: number;

  // Dead players hold the faint: face down, where they fell, until somebody gets them
  // up. Reusing the emote rather than adding a pose means every character can do it,
  // including the three with no hand-drawn sheets beyond walking.
  if (player.dead >= 0) {
    const pose = procPose("faint", DEATH_POSE_TIME, meta, player.dir);
    if (pose) {
      const { sx, sy } = frameRect(meta, pose.frame);
      return { sx, sy, flip: pose.flip, bob: pose.dy, dx: pose.dx, rot: pose.rot };
    }
  }

  const emote = player.emote ? resolveEmote(meta, player.emote) : null;

  if (emote?.kind === "proc") {
    const pose = procPose(emote.name, player.emoteTime, meta, player.dir);
    if (pose) {
      const { sx, sy } = frameRect(meta, pose.frame);
      return { sx, sy, flip: pose.flip, bob: pose.dy, dx: pose.dx, rot: pose.rot };
    }
  }

  if (emote?.kind === "art") {
    clipName = emote.name;
    time = player.emoteTime;
  } else if (player.carrying >= 0 && !player.moving && meta.clips.lift) {
    // Standing still holding something: hold the last frame of the lift, which ends with
    // both arms overhead - exactly where the item is drawn. Walking falls through to the
    // ordinary walk cycle, because there is no carry-walk art and arms-up-while-striding
    // looks worse than arms-down-while-carrying.
    const lift = meta.clips.lift;
    const last = lift.start + lift.count - 1;
    return {
      sx: (last % meta.cols) * FRAME,
      sy: Math.floor(last / meta.cols) * FRAME,
      flip,
      bob: 0,
      dx: 0,
      rot: 0,
    };
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
    dx: 0,
    rot: 0,
  };
}

/**
 * Emotes that hold on their last frame - the laptop, say - stay until the player moves
 * or triggers something else, rather than snapping back after a second. A faint does the
 * same thing through `procSeconds` returning Infinity.
 */
const HOLD_FOREVER = new Set(["laptop"]);

export function emoteFinished(meta: CharacterMeta, emote: string, time: number): boolean {
  if (!emote) return true;
  const resolved = resolveEmote(meta, emote);
  if (!resolved) return true;
  if (resolved.kind === "proc") return time >= procSeconds(resolved.name);
  if (HOLD_FOREVER.has(resolved.name)) return false;
  const clip = meta.clips[resolved.name];
  return !clip || time >= clip.count / clip.fps;
}
