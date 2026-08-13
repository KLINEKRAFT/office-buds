import { FRAME } from "../config";
import type { CharacterMeta } from "./assets";
import type { Dir } from "../types";

/**
 * Emotes, and how to play one for a character that has no art for it.
 *
 * Colin has a hand-drawn wave, a laptop and a jump because those sheets were drawn.
 * Michael has a wave. Alexis, Melanie and Tiffany have six locomotion clips each and
 * nothing else - which meant that for three of the five people in the game, the entire
 * expressive vocabulary was "walk somewhere". They got two HUD buttons, LOG and CHAT,
 * while Colin got five. That is not a missing feature, it is three players being
 * second-class in a game about hanging out.
 *
 * Drawing three more sets of sheets is the honest fix and is not available today. This
 * is the other one: emotes SYNTHESISED from frames every character already has. A spin
 * is the four facings played in order. A hop is the idle frame on a parabola. Panic is
 * the side-walk at double speed, mirrored every eighth of a second. None of it is new
 * art, all of it is legible at 3x, and it costs one transform per frame.
 *
 * Real art always wins where it exists: `art` is tried first, `proc` is the fallback.
 * So Colin's JUMP is his own eight-frame sheet and Melanie's JUMP is a parabola, and
 * both are called JUMP because from the outside they are the same gesture.
 */

/** Where to draw a character this frame, relative to the ordinary pose. */
export interface ProcPose {
  /** Absolute frame index into the atlas. */
  frame: number;
  flip: boolean;
  /** Offsets in world px. Negative dy lifts the sprite off its shadow. */
  dx: number;
  dy: number;
  /**
   * Radians, turned about the feet. Only `faint` uses it, and only ever ends at exactly
   * a quarter turn - which is a transpose, so the sprite that holds on screen is
   * pixel-for-pixel the original rather than a resampled smear.
   */
  rot: number;
}

interface ProcDef {
  seconds: number;
  /** Clips this needs to exist. Every character has all six locomotion clips. */
  needs: string[];
  pose(t: number, meta: CharacterMeta, dir: Dir): ProcPose;
}

/** First frame of a clip, or of idle_down when the character lacks it. */
function first(meta: CharacterMeta, clip: string): number {
  return (meta.clips[clip] ?? meta.clips.idle_down).start;
}

/** Frame `i` of a clip, wrapping. */
function frameAt(meta: CharacterMeta, clip: string, i: number): number {
  const c = meta.clips[clip] ?? meta.clips.idle_down;
  return c.start + (((i % c.count) + c.count) % c.count);
}

const PROC: Record<string, ProcDef> = {
  /**
   * Turn on the spot: down, right, up, left, twice round. The four facings are the four
   * clips every character is built from, so this works for anybody who can walk.
   */
  spin: {
    seconds: 1.12,
    needs: ["idle_down", "idle_side", "idle_up"],
    pose(t, meta) {
      const step = Math.floor(t / 0.14) % 4;
      const clip = step === 0 ? "idle_down" : step === 2 ? "idle_up" : "idle_side";
      return {
        frame: first(meta, clip),
        // Right on the way round, left on the way back, so it reads as one direction of
        // rotation rather than a character flickering between two profiles.
        flip: step === 3,
        dx: 0,
        dy: 0,
        rot: 0,
      };
    },
  },

  /**
   * Bopping. The walk cycle played on the spot with a bob, mirrored on the half beat -
   * the legs are already doing something rhythmic, they just need to stop travelling.
   */
  dance: {
    seconds: 2.6,
    needs: ["walk_down"],
    pose(t, meta) {
      const beat = t * 4.2;
      return {
        frame: frameAt(meta, "walk_down", Math.floor(t * 9)),
        flip: Math.floor(beat) % 2 === 1,
        dx: Math.round(Math.sin(beat * Math.PI) * 2),
        dy: -Math.abs(Math.round(Math.sin(beat * Math.PI * 2) * 2)),
        rot: 0,
      };
    },
  },

  /**
   * Two hops. The shadow deliberately stays on the floor while the sprite goes up, which
   * is the whole reason it reads as leaving the ground rather than sliding upward.
   */
  hop: {
    seconds: 0.92,
    needs: ["idle_down"],
    pose(t, meta, dir) {
      const phase = (t % 0.46) / 0.46;
      const clip = dir === "up" ? "idle_up" : dir === "down" ? "idle_down" : "idle_side";
      return {
        frame: first(meta, clip),
        flip: dir === "left",
        dx: 0,
        dy: -Math.round(Math.sin(phase * Math.PI) * 7),
        rot: 0,
      };
    },
  },

  /**
   * The stand-in for a wave, for the three characters who have no waving sheet.
   *
   * It turns to face you and bounces once, leaning each way - you cannot fake a raised
   * arm without art, but "stop, look at me, bounce" is unmistakably a greeting. Kept
   * deliberately unlike `hop`, which holds your facing and bounces twice: if WAVE and
   * JUMP played the same thing, one of the two buttons would read as broken.
   */
  greet: {
    seconds: 0.78,
    needs: ["idle_down"],
    pose(t, meta) {
      return {
        frame: first(meta, "idle_down"),
        flip: false,
        dx: Math.round(Math.sin(t * 11) * 3),
        dy: -Math.round(Math.abs(Math.sin(t * 7)) * 4),
        rot: 0,
      };
    },
  },

  /**
   * Running on the spot in a blind panic, changing its mind about which way twice a
   * second. The one that made everybody laugh in testing, which is reason enough.
   */
  panic: {
    seconds: 1.5,
    needs: ["walk_side"],
    pose(t, meta) {
      return {
        frame: frameAt(meta, "walk_side", Math.floor(t * 18)),
        flip: Math.floor(t / 0.12) % 2 === 1,
        dx: Math.round(Math.sin(t * 34) * 2),
        dy: -Math.abs(Math.round(Math.sin(t * 26) * 1)),
        rot: 0,
      };
    },
  },

  /**
   * Falls flat and stays there until you move. A quarter turn is a rotation rather than
   * a drawing, so anybody can do it, and it is the correct response to most of what gets
   * said in this office.
   */
  faint: {
    seconds: Infinity,
    needs: ["idle_down"],
    pose(t, meta) {
      // Tips over in a third of a second, easing INTO the fall rather than out of it -
      // a body going over accelerates, and a linear topple reads as being laid down.
      const p = Math.min(1, t / 0.34);
      return {
        frame: first(meta, "idle_down"),
        flip: false,
        dx: 0,
        dy: 0,
        rot: (p * p) * (Math.PI / 2),
      };
    },
  },
};

/**
 * A button in the HUD. `art` is a hand-drawn clip and wins when the character has it;
 * `proc` is the synthesised fallback. An entry with neither available is not offered.
 */
export interface EmoteDef {
  /** The name that travels over the network and is stored in `Player.emote`. */
  clip: string;
  label: string;
  glyph: string;
  art?: string;
  proc?: string;
}

export const EMOTES: EmoteDef[] = [
  { clip: "wave", label: "WAVE", glyph: "✋", art: "wave", proc: "greet" },
  { clip: "jump", label: "JUMP", glyph: "⬆", art: "jump", proc: "hop" },
  { clip: "dance", label: "DANCE", glyph: "\u{1F57A}", proc: "dance" },
  { clip: "spin", label: "SPIN", glyph: "\u{1F300}", proc: "spin" },
  { clip: "panic", label: "PANIC", glyph: "\u{1F631}", proc: "panic" },
  { clip: "faint", label: "FAINT", glyph: "\u{1F480}", proc: "faint" },
  { clip: "laptop", label: "WORK", glyph: "\u{1F4BB}", art: "laptop" },
];

const BY_CLIP = new Map(EMOTES.map((e) => [e.clip, e]));

/** True if `meta` can play `proc` - i.e. it has the locomotion clips it is built from. */
function canProc(meta: CharacterMeta, proc: string): boolean {
  const def = PROC[proc];
  return Boolean(def) && def.needs.every((n) => Boolean(meta.clips[n]));
}

/**
 * How a character will actually play an emote: their own art, a synthesised stand-in,
 * or nothing. One resolver used by the HUD, the animator and the tests, so a button can
 * never appear for something that will not play.
 */
export function resolveEmote(
  meta: CharacterMeta,
  clip: string,
): { kind: "art"; name: string } | { kind: "proc"; name: string } | null {
  const def = BY_CLIP.get(clip);
  // Not a HUD emote at all - `pickup` and `lift` are driven by the game, not a button.
  if (!def) return meta.clips[clip] ? { kind: "art", name: clip } : null;
  if (def.art && meta.clips[def.art]) return { kind: "art", name: def.art };
  if (def.proc && canProc(meta, def.proc)) return { kind: "proc", name: def.proc };
  return null;
}

/** The emote buttons this character can actually offer, in HUD order. */
export function emotesFor(meta: CharacterMeta): EmoteDef[] {
  return EMOTES.filter((e) => resolveEmote(meta, e.clip) !== null);
}

/** Seconds a procedural emote runs for. Infinity means "until you move". */
export function procSeconds(name: string): number {
  return PROC[name]?.seconds ?? 0;
}

/** Where to draw a character playing a procedural emote. */
export function procPose(
  name: string,
  t: number,
  meta: CharacterMeta,
  dir: Dir,
): ProcPose | null {
  const def = PROC[name];
  if (!def) return null;
  const pose = def.pose(t, meta, dir);
  return pose;
}

/** Source rect for an absolute frame index. */
export function frameRect(meta: CharacterMeta, frame: number): { sx: number; sy: number } {
  return {
    sx: (frame % meta.cols) * FRAME,
    sy: Math.floor(frame / meta.cols) * FRAME,
  };
}
