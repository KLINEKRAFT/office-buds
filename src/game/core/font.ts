import type { FontMeta } from "./assets";

/** Combining diacritics left behind by NFD decomposition. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Blits text from the 1-bit bitmap atlas. The atlas is white, so colours are made by
 * pre-tinting a whole copy of it once per colour and caching that - far cheaper than
 * compositing per glyph, and it keeps every pixel on the grid.
 */
export class BitmapFont {
  readonly lineHeight: number;
  private readonly meta: FontMeta;
  private readonly tints = new Map<string, HTMLCanvasElement>();

  constructor(private readonly image: HTMLImageElement, meta: FontMeta) {
    this.meta = meta;
    this.lineHeight = meta.lineHeight;
  }

  private tinted(color: string): HTMLCanvasElement {
    let c = this.tints.get(color);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = this.image.width;
    c.height = this.image.height;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    this.tints.set(color, c);
    return c;
  }

  /**
   * Maps text onto the glyphs the atlas actually has (ASCII 32..126).
   *
   * Accents are decomposed and stripped, so "café" renders as "cafe" rather than losing
   * a letter. Anything still unrepresentable - emoji, CJK - becomes "?" so it is visibly
   * missing instead of silently disappearing, which would make a message of pure emoji
   * render as an empty speech bubble. Iterating with for..of walks code points, so a
   * surrogate pair collapses to a single "?".
   */
  prepare(text: string): string {
    let out = "";
    for (const ch of text.normalize("NFD").replace(COMBINING_MARKS, "")) {
      if (this.meta.glyphs[ch]) out += ch;
      else if (!ch.trim()) out += " ";
      else out += "?";
    }
    return out;
  }

  /** Width in world px of a single line at 1x. */
  measure(text: string): number {
    let w = 0;
    for (const ch of this.prepare(text)) {
      const g = this.meta.glyphs[ch];
      if (!g) continue;
      w += g.advance + this.meta.spacing;
    }
    return Math.max(0, w - this.meta.spacing);
  }

  /** Greedy word wrap. Words longer than maxWidth are hard-broken so nothing overflows. */
  wrap(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const paragraph of this.prepare(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (this.measure(candidate) <= maxWidth) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        if (this.measure(word) <= maxWidth) {
          line = word;
          continue;
        }
        let chunk = "";
        for (const ch of word) {
          if (this.measure(chunk + ch) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      }
      lines.push(line);
    }
    return lines.length ? lines : [""];
  }

  /** Draws with (x, y) as the top-left of the line box. `scale` must be a whole number. */
  draw(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    scale = 1,
  ): void {
    const sheet = this.tinted(color);
    let pen = x;
    for (const ch of this.prepare(text)) {
      const g = this.meta.glyphs[ch];
      if (!g) continue;
      if (g.w > 0) {
        ctx.drawImage(
          sheet,
          g.x,
          g.y,
          g.w,
          this.meta.lineHeight,
          pen + g.left * scale,
          y,
          g.w * scale,
          this.meta.lineHeight * scale,
        );
      }
      pen += (g.advance + this.meta.spacing) * scale;
    }
  }

  /** Convenience for centred labels. */
  drawCentered(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    y: number,
    color: string,
    scale = 1,
  ): void {
    this.draw(ctx, text, Math.round(cx - (this.measure(text) * scale) / 2), y, color, scale);
  }
}
