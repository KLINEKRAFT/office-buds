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
 */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  bubble: Bubble,
  centerX: number,
  bottomY: number,
): void {
  const { w, h } = bubbleSize(font, bubble);
  const x = Math.round(centerX - w / 2);
  const y = Math.round(bottomY - TAIL_H - h);

  ctx.fillStyle = PALETTE.bubbleBorder;
  // Border drawn as a cross of rects, leaving the four corner pixels empty.
  ctx.fillRect(x, y - 1, w, h + 2);
  ctx.fillRect(x - 1, y, w + 2, h);

  ctx.fillStyle = PALETTE.bubbleFill;
  ctx.fillRect(x, y, w, h);

  // Tail: two stacked rects narrowing to a point, with an ink skirt.
  const tx = Math.round(centerX);
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

/** Understated name plate under the feet, with a 1px drop shadow so it reads on carpet. */
export function drawNameTag(
  ctx: CanvasRenderingContext2D,
  font: BitmapFont,
  name: string,
  centerX: number,
  topY: number,
): void {
  font.drawCentered(ctx, name, centerX + 1, topY + 1, PALETTE.nameShadow);
  font.drawCentered(ctx, name, centerX, topY, PALETTE.nameFill);
}
