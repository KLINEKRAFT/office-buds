import { poseFor } from "../core/anim";
import type { Assets } from "../core/assets";
import { BitmapFont } from "../core/font";
import { Camera } from "../core/camera";
import type { StickView } from "../core/input";
import {
  CARRY_LIFT,
  CARRY_LIFT_LOW,
  DOOR_FAR,
  DOOR_NEAR,
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
import type { BuiltRoom, DrawProp } from "../world/build";
import { bubbleFade, drawBubble, drawNameTag } from "./bubble";
import { drawConfetti, drawMood, shakeOffset, type Burst, type Mood } from "../effects";

/** Keeps a camera offset inside the room, or centred when the room is the smaller. */
function clampPan(v: number, roomSize: number, viewSize: number): number {
  if (roomSize <= viewSize) return Math.round((roomSize - viewSize) / 2);
  return Math.min(Math.max(v, 0), roomSize - viewSize);
}

/**
 * Which frame of a door to draw: shut when nobody is near, wide open when somebody is
 * on top of it, and eased between the two in the yard or so in front of it.
 */
function doorFrame(p: DrawProp, players: Player[]): number {
  const ax = p.anchorX ?? p.x;
  const ay = p.anchorY ?? p.y;
  let nearest = Infinity;
  for (const player of players) {
    const d = Math.hypot(player.renderX - ax, player.renderY - ay);
    if (d < nearest) nearest = d;
  }
  const last = (p.frames?.length ?? 1) - 1;
  if (nearest >= DOOR_FAR) return 0;
  if (nearest <= DOOR_NEAR) return last;
  const t = (DOOR_FAR - nearest) / (DOOR_FAR - DOOR_NEAR);
  return Math.round(t * last);
}

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
  /** Roughly how many world px to show vertically. Rooms may override the default. */
  targetViewH = TARGET_VIEW_H;

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
   *
   * The scale is the larger of two demands. `targetViewH` asks to see roughly so much of
   * the world vertically, which is what a big room wants. A small room wants the
   * opposite: zoom in far enough that it fills the screen, or a one-room office ends up
   * a postage stamp adrift in letterbox. Taking the max satisfies whichever matters -
   * the fill term is dead weight in a big room, and the target term is dead weight in a
   * small one. The 0.93 tolerates a few px of letterbox rather than jumping a whole
   * scale step to chase the last one percent.
   */
  resize(cssW: number, cssH: number, camera: Camera, roomW: number, roomH: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const fill = Math.ceil(Math.max(cssW / roomW, cssH / roomH) * 0.93);
    const target = Math.round(cssH / this.targetViewH);
    this.scale =
      this.scaleOverride > 0
        ? this.scaleOverride
        : Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.max(target, fill)));

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
    /** 0 = clear, 1 = fully black. Used to cover a room change. */
    fade = 0,
    mood: Mood = "normal",
    burst: { kind: Burst; time: number } | null = null,
    /** Whether the thing in the circle has been called up. */
    summoned = false,
  ): void {
    const ctx = this.ctx;
    const base = camera.offset();
    // A shake moves the camera, not the world, so props and characters stay in register
    // with each other and only the frame slides.
    const jolt = burst?.kind === "shake" ? shakeOffset(burst.time) : { x: 0, y: 0 };
    // Clamped back inside the room, or a shake against a wall flickers a bar of letterbox
    // along that edge for the whole second.
    const cam = {
      x: clampPan(base.x + jolt.x, room.width, this.world.width),
      y: clampPan(base.y + jolt.y, room.height, this.world.height),
    };
    const viewW = this.world.width;
    const viewH = this.world.height;

    // Letterbox colour for rooms smaller than the viewport.
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.drawImage(room.background, -cam.x, -cam.y);

    // ---- depth-sorted pass -------------------------------------------------
    const items: Drawable[] = [];

    // Anything in somebody's hands is not on the floor. Derived fresh every frame from
    // the players actually present, so it is always consistent with what is drawn over
    // their heads and needs no separate bookkeeping.
    const held = new Set<number>();
    for (const p of players) {
      if (p.carrying >= 0) held.add(p.carrying);
    }

    for (const p of room.floorProps) {
      if (p.propIndex >= 0 && held.has(p.propIndex)) continue;
      if (
        p.x + p.rect.w < cam.x - 8 ||
        p.x > cam.x + viewW + 8 ||
        p.y + p.rect.h < cam.y - 8 ||
        p.y > cam.y + viewH + 8
      ) {
        continue;
      }
      // A door reads its frame off whoever is nearest, so it swings open as somebody
      // walks up to it and shuts behind them. Everybody computes this from positions
      // they already have, so it needs nothing on the wire and cannot get out of step.
      const rect = p.frames ? p.frames[doorFrame(p, players)] : p.rect;
      items.push({
        sortY: p.sortY,
        draw: () => drawSprite(ctx, room.atlas, rect, p.x - cam.x, p.y - cam.y, p.flip),
      });
    }

    // The summoned thing stands at the head of the circle, depth sorted with everyone
    // else so you can walk in front of it.
    const summonSpot = room.def.summonAt;
    if (summoned && summonSpot) {
      const rect = room.sprites.wraith;
      if (rect) {
        const sx = summonSpot.x - cam.x;
        const sy = summonSpot.y - cam.y;
        items.push({
          sortY: summonSpot.y,
          draw: () => {
            // Bobbing, and never quite solid.
            const bob = Math.round(Math.sin(now / 420) * 2);
            ctx.globalAlpha = 0.82;
            drawSprite(ctx, room.atlas, rect, sx - Math.round(rect.w / 2), sy - rect.h + bob, false);
            ctx.globalAlpha = 1;
          },
        });
      }
    }

    for (const player of players) {
      const asset = this.assets.characters[player.character];
      if (!asset) continue;
      // Taken by the ceremony: you are drawn as the thing you became, not as yourself.
      // Uses the pack's own wraith rather than any new art, and the name plate stays so
      // it is obvious who is gone.
      const ghost = player.ascended ? room.sprites.wraith : undefined;
      const speed = player.id === localId ? localSpeed : WALK_SPEED;
      const pose = poseFor(player, asset.meta, speed);
      const cx = Math.round(player.renderX) - cam.x;
      const feetY = Math.round(player.renderY) - cam.y;

      const carried =
        player.carrying >= 0 ? room.def.props[player.carrying]?.sprite : undefined;
      const carriedRect = carried ? room.sprites[carried] : undefined;
      // Where the hands actually are. A character with a lift clip holds it overhead;
      // one without keeps their arms down, and an item floating above their head would
      // read as levitating rather than carried, so it rides at chest height instead.
      const holdY = asset.meta.clips.lift ? CARRY_LIFT : CARRY_LIFT_LOW;

      items.push({
        sortY: player.renderY,
        draw: () => {
          if (ghost) {
            const bob = Math.round(Math.sin(now / 380 + cx) * 2);
            ctx.globalAlpha = 0.8;
            drawSprite(ctx, room.atlas, ghost, cx - Math.round(ghost.w / 2), feetY - ghost.h + bob, false);
            ctx.globalAlpha = 1;
            return;
          }
          // The shadow stays where the feet are, and is NOT offset by the pose. That is
          // what sells a hop: the sprite leaves the ground and its shadow does not go
          // with it.
          this.drawShadow(cx, feetY);
          // One transform for every case - mirrored side walks, a swaying dance, a
          // quarter-turn faint. Every term is a whole number, so the sprite still lands
          // on the pixel grid and stays crisp.
          ctx.save();
          ctx.translate(cx + pose.dx, feetY + pose.bob);
          if (pose.rot !== 0) ctx.rotate(pose.rot);
          if (pose.flip) ctx.scale(-1, 1);
          ctx.drawImage(
            asset.image,
            pose.sx,
            pose.sy,
            FRAME,
            FRAME,
            -FRAME / 2,
            -FRAME,
            FRAME,
            FRAME,
          );
          ctx.restore();
          // Held overhead, bottom-centred on the hands. Drawn with the carrier rather
          // than as its own sortable item so it can never separate from them.
          // Hidden for the length of the grab clip: the whole point of that animation is
          // reaching down for the thing, which reads as nonsense if it is already in the
          // air above them.
          if (carriedRect && player.emote !== "pickup") {
            drawSprite(
              ctx,
              room.atlas,
              carriedRect,
              cx + pose.dx - Math.round(carriedRect.w / 2),
              feetY - holdY - carriedRect.h + pose.bob,
              false,
            );
          }
        },
      });
    }

    items.sort((a, b) => a.sortY - b.sortY);
    for (const item of items) item.draw();

    // ---- overlays ----------------------------------------------------------
    // Drawn after every sprite so a name or bubble is never hidden behind furniture.
    // Name plates get stacked rather than overlapped. Two friends standing on the same
    // spot is the normal case in this game, and un-nudged the plates overprint into an
    // unreadable smear.
    const sorted = [...players].sort((a, b) => a.renderY - b.renderY);
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const lineH = this.fontSmall.lineHeight;
    for (const player of sorted) {
      const cx = Math.round(player.renderX) - cam.x;
      const feetY = Math.round(player.renderY) - cam.y;
      const w = this.fontSmall.measure(player.name) + 2;
      let y = feetY + 3;
      const box = () => ({ x: cx - w / 2, y, w, h: lineH });
      for (let guard = 0; guard < 6; guard++) {
        const b = box();
        if (!placed.some((p) => p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y)) {
          break;
        }
        y += lineH + 1;
      }
      placed.push(box());
      drawNameTag(ctx, this.fontSmall, player.name, cx, y);
    }
    for (const player of sorted) {
      if (!player.bubble) continue;
      const gone = bubbleFade(player.bubble, now);
      if (gone >= 1) continue;
      const cx = Math.round(player.renderX) - cam.x;
      let headY = Math.round(player.renderY) - cam.y - FRAME;
      // Talking while holding the photocopier over your head: lift the bubble clear of
      // it rather than letting the two overlap.
      const carried =
        player.carrying >= 0 ? room.def.props[player.carrying]?.sprite : undefined;
      const carriedRect = carried ? room.sprites[carried] : undefined;
      const hold = this.assets.characters[player.character]?.meta.clips.lift
        ? CARRY_LIFT
        : CARRY_LIFT_LOW;
      if (carriedRect) headY = Math.min(headY, headY - (hold - FRAME) - carriedRect.h);
      ctx.globalAlpha = 1 - gone;
      drawBubble(ctx, this.font, player.bubble, cx, headY - 1);
      ctx.globalAlpha = 1;
    }

    // ---- room effects, over everything but under the touch stick ----------------
    drawMood(
      ctx,
      mood,
      now / 1000,
      viewW,
      viewH,
      players.map((p) => ({
        x: Math.round(p.renderX) - cam.x,
        y: Math.round(p.renderY) - cam.y,
      })),
    );
    if (burst?.kind === "confetti") drawConfetti(ctx, burst.time, viewW, viewH);

    if (fade > 0) {
      ctx.globalAlpha = Math.min(1, fade);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(0, 0, viewW, viewH);
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
