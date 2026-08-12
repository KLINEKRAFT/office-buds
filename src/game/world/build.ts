import type { Assets, SpriteRect } from "../core/assets";
import { TILE } from "../config";
import type { Rect } from "../types";
import type { PropDef, RoomDef } from "./types";

export interface DrawProp {
  rect: SpriteRect;
  /** Top-left draw position in world px. */
  x: number;
  y: number;
  flip: boolean;
  /** Depth sort key. */
  sortY: number;
}

export interface BuiltRoom {
  def: RoomDef;
  width: number;
  height: number;
  wallHeight: number;
  /** Pre-rendered floor + wall + wall-mounted props. Blitted once per frame. */
  background: HTMLCanvasElement;
  /** Depth-sorted props that characters can walk in front of and behind. */
  floorProps: DrawProp[];
  colliders: Rect[];
}

/**
 * Default floor footprint for a solid prop: the bottom slice of its sprite, inset a
 * little. Front-elevation furniture is drawn taller than the floor space it occupies,
 * so using the whole sprite as a collider would feel like walking into invisible walls.
 */
function autoCollider(def: PropDef, rect: SpriteRect): Rect {
  const depth = Math.max(5, Math.round(rect.h * 0.4));
  const inset = rect.w > 14 ? 2 : 1;
  return {
    x: def.x - rect.w / 2 + inset,
    y: def.y - depth,
    w: Math.max(2, rect.w - inset * 2),
    h: depth,
  };
}

function missing(sprite: string): never {
  throw new Error(`room references unknown sprite "${sprite}"`);
}

function layerRank(p: PropDef): number {
  if (p.layer === "ground") return 0;
  if (p.layer === "wall") return 1;
  return 2;
}

export function buildRoom(def: RoomDef, assets: Assets): BuiltRoom {
  const width = def.widthTiles * TILE;
  const floorHeight = def.heightTiles * TILE;
  const height = def.wallHeight + floorHeight;

  const atlas = assets.props;
  const get = (name: string): SpriteRect => atlas.sprites[name] ?? missing(name);

  // ---- static background ------------------------------------------------
  const background = document.createElement("canvas");
  background.width = width;
  background.height = height;
  const ctx = background.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const wall = get("wall");
  const wallCap = get("wall_cap");
  const baseboard = get("baseboard");
  const floorA = get("floor_a");
  const floorB = get("floor_b");

  for (let y = 0; y < def.wallHeight; y += TILE) {
    for (let x = 0; x < width; x += TILE) {
      ctx.drawImage(atlas.image, wall.x, wall.y, wall.w, wall.h, x, y, wall.w, wall.h);
    }
  }
  for (let x = 0; x < width; x += TILE) {
    ctx.drawImage(atlas.image, wallCap.x, wallCap.y, wallCap.w, wallCap.h, x, 0, wallCap.w, wallCap.h);
  }

  for (let y = def.wallHeight; y < height; y += TILE) {
    for (let x = 0; x < width; x += TILE) {
      const alt = ((x / TILE + y / TILE) & 1) === 0;
      const t = alt ? floorA : floorB;
      ctx.drawImage(atlas.image, t.x, t.y, t.w, t.h, x, y, t.w, t.h);
    }
  }

  // Zoned carpet, laid over the base floor on the same grid.
  for (const zone of def.floorZones ?? []) {
    const [keyA, keyB] = zone.tiles;
    const a = get(keyA);
    const b = get(keyB);
    for (let ty = zone.ty; ty < zone.ty + zone.th; ty++) {
      for (let tx = zone.tx; tx < zone.tx + zone.tw; tx++) {
        const x = tx * TILE;
        const y = def.wallHeight + ty * TILE;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const t = ((tx + ty) & 1) === 0 ? a : b;
        ctx.drawImage(atlas.image, t.x, t.y, t.w, t.h, x, y, t.w, t.h);
      }
    }
  }

  // Skirting sits on the seam between wall and floor.
  for (let x = 0; x < width; x += TILE) {
    ctx.drawImage(
      atlas.image,
      baseboard.x,
      baseboard.y,
      baseboard.w,
      baseboard.h,
      x,
      def.wallHeight - baseboard.h,
      baseboard.w,
      baseboard.h,
    );
  }

  const floorProps: DrawProp[] = [];
  const colliders: Rect[] = [];

  // Ground props go down before wall props so a rug can never cover the skirting.
  const ordered = [...def.props].sort((a, b) => layerRank(a) - layerRank(b));

  for (const p of ordered) {
    const rect = get(p.sprite);
    const drawX = Math.round(p.x - rect.w / 2);
    const drawY = Math.round(p.y - rect.h);

    if (p.layer === "wall" || p.layer === "ground") {
      drawSprite(ctx, atlas.image, rect, drawX, drawY, p.flip ?? false);
    } else {
      floorProps.push({
        rect,
        x: drawX,
        y: drawY,
        flip: p.flip ?? false,
        sortY: p.y + (p.bias ?? 0),
      });
    }

    if (p.solid) colliders.push(p.collider ?? autoCollider(p, rect));
  }

  floorProps.sort((a, b) => a.sortY - b.sortY);
  for (const b of def.blockers ?? []) colliders.push(b);

  return { def, width, height, wallHeight: def.wallHeight, background, floorProps, colliders };
}

/** Shared sprite blit that understands horizontal flipping. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  rect: SpriteRect,
  x: number,
  y: number,
  flip: boolean,
): void {
  if (!flip) {
    ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, x, y, rect.w, rect.h);
    return;
  }
  ctx.save();
  ctx.translate(x + rect.w, y);
  ctx.scale(-1, 1);
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  ctx.restore();
}
