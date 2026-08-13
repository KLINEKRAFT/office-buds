/**
 * Room effects: the weird stuff that happens when somebody says the right thing.
 *
 * Two kinds. A MOOD is a state the room sits in until it is changed - the lights are
 * either on, dimmed for a party, or off. A BURST is a one-shot that plays out and ends -
 * the room shakes, confetti falls.
 *
 * Both are broadcast rather than derived, because unlike a carried item they are not
 * worth being strict about: if a packet goes missing, the worst case is somebody's
 * lights stay on through one song, and the next "party time" puts it right. Carried
 * items get the careful treatment; disco lighting does not need it.
 *
 * Everything here is drawn procedurally into the world canvas at world resolution, so it
 * upscales with the same chunky pixels as the art and costs no assets.
 */

export type Mood = "normal" | "party" | "dark" | "ritual";
export type Burst = "shake" | "confetti";

export const MOODS: readonly Mood[] = ["normal", "party", "dark", "ritual"];
export const BURSTS: readonly Burst[] = ["shake", "confetti"];

export function isMood(v: string): v is Mood {
  return (MOODS as readonly string[]).includes(v);
}
export function isBurst(v: string): v is Burst {
  return (BURSTS as readonly string[]).includes(v);
}

/** How long each burst runs, in seconds. */
export const BURST_SECONDS: Record<Burst, number> = {
  shake: 1.1,
  confetti: 6,
};

/** Party colours, cycled. Deliberately saturated - everything else in here is muted. */
const PARTY_LIGHTS = [
  [255, 60, 120],
  [80, 140, 255],
  [120, 255, 140],
  [255, 200, 60],
  [200, 90, 255],
];

const CONFETTI = ["#ff3c78", "#50a0ff", "#78ff8c", "#ffc83c", "#c85aff", "#eae6da"];

/**
 * Camera offset for a shake, in world px. Two sine waves at unrelated frequencies rather
 * than random noise, so it reads as a rumble rather than as jitter, and decays to nothing
 * so it never leaves the camera parked off-centre.
 */
export function shakeOffset(elapsed: number): { x: number; y: number } {
  const left = Math.max(0, 1 - elapsed / BURST_SECONDS.shake);
  const amp = left * left * 3.2;
  return {
    x: Math.round(Math.sin(elapsed * 41) * amp),
    y: Math.round(Math.sin(elapsed * 27 + 1.7) * amp * 0.6),
  };
}

/**
 * Paints the mood over the finished frame.
 *
 * `lights` are the points worth being able to see - the players - so the dark is not
 * total and a party has something to wash across.
 */
export function drawMood(
  ctx: CanvasRenderingContext2D,
  mood: Mood,
  t: number,
  w: number,
  h: number,
  lights: Array<{ x: number; y: number }>,
): void {
  if (mood === "normal") return;

  const dim = mood === "dark" ? 0.88 : mood === "ritual" ? 0.62 : 0.42;
  ctx.fillStyle =
    mood === "dark" ? "#05050c" : mood === "ritual" ? "#0a0f0a" : "#0d0a1e";
  ctx.globalAlpha = dim;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = "lighter";

  if (mood === "ritual") {
    // Candlelight: a slow green wash with a flicker that never quite repeats, because
    // two sine waves at unrelated speeds beat against each other instead of looping.
    const flicker = 0.13 + 0.05 * Math.sin(t * 9.1) + 0.03 * Math.sin(t * 3.7);
    ctx.fillStyle = `rgba(80,190,120,${Math.max(0.06, flicker)})`;
    ctx.fillRect(0, 0, w, h);
    for (const l of lights) {
      const g = ctx.createRadialGradient(l.x, l.y - 16, 2, l.x, l.y - 16, 30);
      g.addColorStop(0, "rgba(150,255,180,0.30)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(l.x - 30, l.y - 46, 60, 60);
    }
  } else if (mood === "dark") {
    // A little light left on each person, or the room is just a black rectangle and
    // nobody can tell the difference between that and a crash.
    for (const l of lights) {
      const g = ctx.createRadialGradient(l.x, l.y - 14, 2, l.x, l.y - 14, 34);
      g.addColorStop(0, "rgba(120,120,150,0.55)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(l.x - 34, l.y - 48, 68, 68);
    }
  } else {
    // Three lamps sweeping the room on different orbits, plus a slow wash so the whole
    // floor keeps changing colour rather than only the spots.
    for (let i = 0; i < 3; i++) {
      const c = PARTY_LIGHTS[(Math.floor(t * 1.6) + i * 2) % PARTY_LIGHTS.length];
      const cx = w * (0.5 + 0.42 * Math.sin(t * (0.7 + i * 0.23) + i * 2.1));
      const cy = h * (0.42 + 0.34 * Math.cos(t * (0.5 + i * 0.19) + i * 1.3));
      const r = Math.min(w, h) * 0.42;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.5)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    const beat = 0.1 + 0.07 * Math.max(0, Math.sin(t * 7.4));
    const wash = PARTY_LIGHTS[Math.floor(t * 2.3) % PARTY_LIGHTS.length];
    ctx.fillStyle = `rgba(${wash[0]},${wash[1]},${wash[2]},${beat})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.globalCompositeOperation = "source-over";
}

/**
 * Falling confetti. Entirely a function of elapsed time - each piece's position is
 * computed from its index, so there is no particle list to allocate, update or leak, and
 * two browsers showing the same burst show the same confetti.
 */
export function drawConfetti(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  w: number,
  h: number,
): void {
  const left = 1 - elapsed / BURST_SECONDS.confetti;
  if (left <= 0) return;
  ctx.globalAlpha = Math.min(1, left * 2.5);
  for (let i = 0; i < 70; i++) {
    const seed = i * 2654435761;
    const x = (seed % 1000) / 1000;
    const speed = 26 + ((seed >>> 7) % 40);
    const sway = Math.sin(elapsed * 2.4 + i) * 4;
    const y = ((elapsed * speed + ((seed >>> 3) % h)) % (h + 20)) - 10;
    ctx.fillStyle = CONFETTI[i % CONFETTI.length];
    ctx.fillRect(Math.round(x * w + sway), Math.round(y), 2, i % 3 === 0 ? 3 : 2);
  }
  ctx.globalAlpha = 1;
}
