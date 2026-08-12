import { BODY_H, BODY_W } from "../config";
import type { Rect } from "../types";
import type { BuiltRoom } from "./build";

/** Feet-level box for a character standing at (x, y). */
export function bodyRect(x: number, y: number): Rect {
  return { x: x - BODY_W / 2, y: y - BODY_H, w: BODY_W, h: BODY_H };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function blocked(room: BuiltRoom, x: number, y: number): boolean {
  const body = bodyRect(x, y);
  for (const c of room.colliders) {
    if (overlaps(body, c)) return true;
  }
  return false;
}

const EDGE = 6; // keep the sprite's shoulders inside the room

function clampToRoom(room: BuiltRoom, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, EDGE), room.width - EDGE),
    // Feet cannot go above the base of the wall, nor past the bottom edge.
    y: Math.min(Math.max(y, room.wallHeight + 1), room.height - 2),
  };
}

/**
 * Moves a character by (dx, dy), resolving each axis separately so sliding along a
 * desk edge feels smooth instead of sticking in corners.
 */
export function moveWithCollision(
  room: BuiltRoom,
  x: number,
  y: number,
  dx: number,
  dy: number,
): { x: number; y: number } {
  let nx = x;
  let ny = y;

  if (dx !== 0) {
    const target = clampToRoom(room, nx + dx, ny);
    if (!blocked(room, target.x, ny)) nx = target.x;
  }
  if (dy !== 0) {
    const target = clampToRoom(room, nx, ny + dy);
    if (!blocked(room, nx, target.y)) ny = target.y;
  }

  const c = clampToRoom(room, nx, ny);
  return { x: c.x, y: c.y };
}

/**
 * Finds a free spot near `spawn`, spiralling outwards. Stops two players who join at
 * the same moment from standing exactly on top of each other.
 */
export function findFreeSpawn(room: BuiltRoom, x: number, y: number): { x: number; y: number } {
  if (!blocked(room, x, y)) return { x, y };
  for (let r = 8; r <= 120; r += 8) {
    for (let a = 0; a < 12; a++) {
      const t = (a / 12) * Math.PI * 2;
      const c = clampToRoom(room, x + Math.cos(t) * r, y + Math.sin(t) * r);
      if (!blocked(room, c.x, c.y)) return c;
    }
  }
  return clampToRoom(room, x, y);
}
