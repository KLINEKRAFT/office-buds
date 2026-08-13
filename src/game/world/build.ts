import type { Assets, SpriteRect } from "../core/assets";
import { TILE } from "../config";
import type { Rect } from "../types";
import type { AtlasId, PropDef, RoomDef } from "./types";

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
  /** The atlas this room's props are drawn from. */
  atlas: HTMLImageElement;
  /** Pre-rendered ground, walls and wall-mounted props. Blitted once per frame. */
  background: HTMLCanvasElement;
  /** Depth-sorted props that characters can walk in front of and behind. */
  floorProps: DrawProp[];
  colliders: Rect[];
}

/**
 * Default ground footprint for a solid prop: the bottom slice of its sprite, inset a
 * little. Front-elevation furniture and trees are drawn far taller than the ground they
 * occupy, so using the whole sprite would feel like walking into invisible walls.
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

function layerRank(p: PropDef): number {
  if (p.layer === "ground") return 0;
  if (p.layer === "wall") return 1;
  return 2;
}

/**
 * Cheap deterministic hash. Ground tiles pick their variant from this so a field of
 * grass never falls into a visible repeat, and the same tile is the same every frame.
 */
function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function atlasFor(assets: Assets, id: AtlasId) {
  return id === "village" ? assets.village : assets.props;
}

export function buildRoom(def: RoomDef, assets: Assets): BuiltRoom {
  const width = def.widthTiles * TILE;
  const groundHeight = def.heightTiles * TILE;
  const height = def.wallHeight + groundHeight;

  const source = atlasFor(assets, def.atlas);
  if (!source) throw new Error(`atlas "${def.atlas}" is not loaded`);
  const get = (name: string): SpriteRect => {
    const r = source.sprites[name];
    if (!r) throw new Error(`room "${def.id}" references unknown sprite "${name}"`);
    return r;
  };

  const background = document.createElement("canvas");
  background.width = width;
  background.height = height;
  const ctx = background.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const blit = (rect: SpriteRect, x: number, y: number) =>
    ctx.drawImage(source.image, rect.x, rect.y, rect.w, rect.h, x, y, rect.w, rect.h);

  // ---- ground ------------------------------------------------------------
  const ground = def.groundTiles.map(get);
  for (let ty = 0; ty < def.heightTiles; ty++) {
    for (let tx = 0; tx < def.widthTiles; tx++) {
      const t = ground[tileHash(tx, ty) % ground.length];
      blit(t, tx * TILE, def.wallHeight + ty * TILE);
    }
  }

  const colliders: Rect[] = [];

  for (const zone of def.floorZones ?? []) {
    const tiles = zone.tiles.map(get);
    for (let ty = zone.ty; ty < zone.ty + zone.th; ty++) {
      for (let tx = zone.tx; tx < zone.tx + zone.tw; tx++) {
        if (tx < 0 || ty < 0 || tx >= def.widthTiles || ty >= def.heightTiles) continue;
        const t = tiles[tileHash(tx + 977, ty + 311) % tiles.length];
        blit(t, tx * TILE, def.wallHeight + ty * TILE);
      }
    }
    if (zone.solid) {
      colliders.push({
        x: zone.tx * TILE,
        y: def.wallHeight + zone.ty * TILE,
        w: zone.tw * TILE,
        h: zone.th * TILE,
      });
    }
  }

  // ---- wall band (indoor rooms only) --------------------------------------
  if (def.wallHeight > 0) {
    const wall = get("wall");
    const wallCap = get("wall_cap");
    const baseboard = get("baseboard");
    for (let y = 0; y < def.wallHeight; y += TILE) {
      for (let x = 0; x < width; x += TILE) blit(wall, x, y);
    }
    for (let x = 0; x < width; x += TILE) blit(wallCap, x, 0);
    for (let x = 0; x < width; x += TILE) {
      blit(baseboard, x, def.wallHeight - baseboard.h);
    }
  }

  // ---- props ---------------------------------------------------------------
  const floorProps: DrawProp[] = [];
  const ordered = [...def.props].sort((a, b) => layerRank(a) - layerRank(b));

  for (const p of ordered) {
    const rect = get(p.sprite);
    const drawX = Math.round(p.x - rect.w / 2);
    const drawY = Math.round(p.y - rect.h);

    if (p.layer === "wall" || p.layer === "ground") {
      drawSprite(ctx, source.image, rect, drawX, drawY, p.flip ?? false);
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

  if (def.tint) {
    ctx.globalAlpha = def.tint.alpha;
    ctx.fillStyle = def.tint.color;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  }

  return {
    def,
    width,
    height,
    wallHeight: def.wallHeight,
    atlas: source.image,
    background,
    floorProps,
    colliders,
  };
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
