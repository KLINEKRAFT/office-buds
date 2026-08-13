import { poseFor } from "../core/anim";
import type { Assets } from "../core/assets";
import { BitmapFont } from "../core/font";
import { Camera } from "../core/camera";
import type { StickView } from "../core/input";
import {
  FRAME,
  MAX_SCALE,
  MIN_SCALE,
  PALETTE,
  STICK_RADIUS,
  TARGET_VIEW_H,
  WALK_SPEED,
} from "../config";
import type { Player } from "../types";
import { drawSprite } from "../world/build";
import type { BuiltRoom } from "../world/build";
import { bubbleFade, drawBubble, drawNameTag } from "./bubble";

/** Widths of each row of the 5-row character shadow, so it stays a crisp pixel blob. */
const SHADOW_ROWS = [10, 14, 16, 14, 10];

interface Drawable {
  sortY: number;
  draw(): void;
}

export class Renderer {
  private readonly display: CanvasRenderingContext2D;
  private world: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly font: BitmapFont;
  private readonly fontSmall: BitmapFont;
  /** Draws collision boxes over the room; toggled with ?debug=1. */
  debugColliders = false;
  /** Forces a display scale instead of deriving one; set with ?scale=N. */
  scaleOverride = 0;

  /** World px -> CSS px. Always a whole number. */
  scale = 3;
  private dpr = 1;
  private cssW = 0;
  private cssH = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly assets: Assets,
  ) {
    this.display = canvas.getContext("2d", { alpha: false })!;
    this.world = document.createElement("canvas");
    this.ctx = this.world.getContext("2d", { alpha: false })!;
    this.font = new BitmapFont(assets.font.image, assets.font.meta);
    this.fontSmall = new BitmapFont(assets.fontSmall.image, assets.fontSmall.meta);
  }

  /**
   * Sizes the canvases. Everything is drawn once at world resolution then blitted up by
   * a whole number, which is what keeps the art crisp and costs one GPU scale per frame
   * instead of scaling every sprite.
   */
  resize(cssW: number, cssH: number, camera: Camera): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.scale =
      this.scaleOverride > 0
        ? this.scaleOverride
        : Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(cssH / TARGET_VIEW_H)));

    // Floor, not ceil: the canvas must never be wider than the viewport, or the browser
    // clips a half pixel off each edge and the outermost column goes soft. Rounding down
    // leaves at most scale-1 px of backdrop showing, which is invisible against the ink.
    const viewW = Math.max(1, Math.floor(cssW / this.scale));
    const viewH = Math.max(1, Math.floor(cssH / this.scale));
    this.world.width = viewW;
    this.world.height = viewH;
    this.ctx = this.world.getContext("2d", { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;

    camera.viewW = viewW;
    camera.viewH = viewH;

    this.canvas.width = Math.round(viewW * this.scale * this.dpr);
    this.canvas.height = Math.round(viewH * this.scale * this.dpr);
    this.canvas.style.width = `${viewW * this.scale}px`;
    this.canvas.style.height = `${viewH * this.scale}px`;
    this.display.imageSmoothingEnabled = false;
  }

  private drawShadow(cx: number, feetY: number): void {
    this.ctx.fillStyle = PALETTE.shadow;
    SHADOW_ROWS.forEach((w, i) => {
      this.ctx.fillRect(Math.round(cx - w / 2), feetY - 3 + i, w, 1);
    });
  }

  render(
    room: BuiltRoom,
    camera: Camera,
    players: Player[],
    localId: string,
    localSpeed: number,
    stick: StickView | null,
    now: number,
  ): void {
    const ctx = this.ctx;
    const cam = camera.offset();
    const viewW = this.world.width;
    const viewH = this.world.height;

    // Letterbox colour for rooms smaller than the viewport.
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.drawImage(room.background, -cam.x, -cam.y);

    // ---- depth-sorted pass -------------------------------------------------
    const items: Drawable[] = [];

    for (const p of room.floorProps) {
      if (
        p.x + p.rect.w < cam.x - 8 ||
        p.x > cam.x + viewW + 8 ||
        p.y + p.rect.h < cam.y - 8 ||
        p.y > cam.y + viewH + 8
      ) {
        continue;
      }
      items.push({
        sortY: p.sortY,
        draw: () =>
          drawSprite(ctx, this.assets.props.image, p.rect, p.x - cam.x, p.y - cam.y, p.flip),
      });
    }

    for (const player of players) {
      const asset = this.assets.characters[player.character];
      if (!asset) continue;
      const speed = player.id === localId ? localSpeed : WALK_SPEED;
      const pose = poseFor(player, asset.meta, speed);
      const cx = Math.round(player.renderX) - cam.x;
      const feetY = Math.round(player.renderY) - cam.y;

      items.push({
        sortY: player.renderY,
        draw: () => {
          this.drawShadow(cx, feetY);
          const dx = cx - FRAME / 2;
          const dy = feetY - FRAME + pose.bob;
          if (pose.flip) {
            ctx.save();
            ctx.translate(dx + FRAME, dy);
            ctx.scale(-1, 1);
            ctx.drawImage(asset.image, pose.sx, pose.sy, FRAME, FRAME, 0, 0, FRAME, FRAME);
            ctx.restore();
          } else {
            ctx.drawImage(asset.image, pose.sx, pose.sy, FRAME, FRAME, dx, dy, FRAME, FRAME);
          }
        },
      });
    }

    items.sort((a, b) => a.sortY - b.sortY);
    for (const item of items) item.draw();

    // ---- overlays ----------------------------------------------------------
    // Drawn after every sprite so a name or bubble is never hidden behind furniture.
    const sorted = [...players].sort((a, b) => a.renderY - b.renderY);
    for (const player of sorted) {
      const cx = Math.round(player.renderX) - cam.x;
      const feetY = Math.round(player.renderY) - cam.y;
      drawNameTag(ctx, this.fontSmall, player.name, cx, feetY + 3);
    }
    for (const player of sorted) {
      if (!player.bubble) continue;
      const fade = bubbleFade(player.bubble, now);
      if (fade >= 1) continue;
      const cx = Math.round(player.renderX) - cam.x;
      const headY = Math.round(player.renderY) - cam.y - FRAME;
      ctx.globalAlpha = 1 - fade;
      drawBubble(ctx, this.font, player.bubble, cx, headY - 1);
      ctx.globalAlpha = 1;
    }

    if (this.debugColliders) {
      ctx.strokeStyle = "rgba(255,64,96,0.9)";
      ctx.lineWidth = 1;
      for (const c of room.colliders) {
        ctx.strokeRect(c.x - cam.x + 0.5, c.y - cam.y + 0.5, c.w - 1, c.h - 1);
      }
    }

    if (stick?.active) this.drawStick(stick);

    // ---- one scaled blit ---------------------------------------------------
    this.display.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.display.drawImage(this.world, 0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * The touch stick is drawn into the world canvas so it upscales with the same chunky
   * pixels as everything else, rather than looking like a slick modern overlay.
   */
  private drawStick(stick: StickView): void {
    const ctx = this.ctx;
    const ox = Math.round(stick.originX / this.scale);
    const oy = Math.round(stick.originY / this.scale);
    const kx = Math.round(stick.knobX / this.scale);
    const ky = Math.round(stick.knobY / this.scale);

    ctx.globalAlpha = 0.34;
    ctx.fillStyle = PALETTE.cream;
    // Ring: four arcs approximated by single-pixel steps around the radius.
    for (let a = 0; a < 32; a++) {
      const t = (a / 32) * Math.PI * 2;
      ctx.fillRect(
        Math.round(ox + Math.cos(t) * STICK_RADIUS),
        Math.round(oy + Math.sin(t) * STICK_RADIUS),
        1,
        1,
      );
    }
    ctx.globalAlpha = 0.6;
    ctx.fillRect(kx - 4, ky - 3, 8, 6);
    ctx.fillRect(kx - 3, ky - 4, 6, 8);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(kx - 2, ky - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  /** CSS size the canvas element settled on, for centring it in the page. */
  get cssSize(): { w: number; h: number } {
    return { w: this.cssW, h: this.cssH };
  }
}
