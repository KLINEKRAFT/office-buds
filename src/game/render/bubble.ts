import { BUBBLE_FADE_MS, PALETTE } from "../config";
import type { BitmapFont } from "../core/font";
import type { Bubble } from "../types";

const PAD_X = 4;
const PAD_Y = 3;
const TAIL_H = 3;

export function bubbleSize(font: BitmapFont, bubble: Bubble): { w: number; h: number } {
  const textW = Math.max(...bubble.lines.map((l) => font.measure(l)));
  return {
    w: textW + PAD_X * 2,
    h: bubble.lines.length * font.lineHeight + PAD_Y * 2,
  };
}

/** 0 while fully visible, ramping to 1 as the bubble expires. */
export function bubbleFade(bubble: Bubble, now: number): number {
  const left = bubble.born + bubble.duration - now;
  if (left <= 0) return 1;
  if (left >= BUBBLE_FADE_MS) return 0;
  return 1 - left / BUBBLE_FADE_MS;
}

/**
 * Classic RPG dialogue box: flat cream panel, hard 1px ink border, notched corners
 * instead of a radius, and a stubby tail pointing at the speaker. Everything is drawn
 * with whole-pixel rects so it survives nearest-neighbour upscaling.
 *
 * The panel is kept inside the viewport while the tail stays under the speaker, so
 * somebody talking at the edge of the room gets a bubble that slides across rather than
 * a sentence with its second half cut off. The canvas IS the viewport here - the world
 * is drawn at 1:1 and blitted up afterwards - so its own size is the bound to clamp to.
 */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  bubble: Bubble,
  speakerX: number,
  bottomY: number,
): void {
  const { w, h } = bubbleSize(font, bubble);
  const half = w / 2;
  const centerX =
    w + 2 >= ctx.canvas.width
      ? speakerX
      : Math.min(Math.max(speakerX, half + 1), ctx.canvas.width - half - 1);
  const x = Math.round(centerX - w / 2);
  const y = Math.max(1, Math.round(bottomY - TAIL_H - h));

  ctx.fillStyle = PALETTE.bubbleBorder;
  // Border drawn as a cross of rects, leaving the four corner pixels empty.
  ctx.fillRect(x, y - 1, w, h + 2);
  ctx.fillRect(x - 1, y, w + 2, h);

  ctx.fillStyle = PALETTE.bubbleFill;
  ctx.fillRect(x, y, w, h);

  // Tail: two stacked rects narrowing to a point, with an ink skirt. It follows the
  // speaker, held far enough inside the panel that it never hangs off a corner.
  const tx = Math.round(Math.min(Math.max(speakerX, x + 4), x + w - 4));
  ctx.fillStyle = PALETTE.bubbleBorder;
  ctx.fillRect(tx - 3, y + h, 6, 1);
  ctx.fillRect(tx - 2, y + h + 1, 4, 1);
  ctx.fillRect(tx - 1, y + h + 2, 2, 1);
  ctx.fillStyle = PALETTE.bubbleFill;
  ctx.fillRect(tx - 2, y + h, 4, 1);
  ctx.fillRect(tx - 1, y + h + 1, 2, 1);

  bubble.lines.forEach((line, i) => {
    font.drawCentered(ctx, line, centerX, y + PAD_Y + i * font.lineHeight, PALETTE.ink);
  });
}

/**
 * Understated name plate. A drop shadow alone was fine on carpet but disappeared over a
 * keyboard or a patch of grass, so the text sits on a low-contrast plate - just enough
 * to separate it from whatever is behind, without turning into a UI label.
 */
export function drawNameTag(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  name: string,
  centerX: number,
  topY: number,
): void {
  const w = font.measure(name);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(Math.round(centerX - w / 2) - 2, topY - 1, w + 4, font.lineHeight + 1);
  ctx.globalAlpha = 1;
  font.drawCentered(ctx, name, centerX + 1, topY + 1, PALETTE.nameShadow);
  font.drawCentered(ctx, name, centerX, topY, PALETTE.nameFill);
}
