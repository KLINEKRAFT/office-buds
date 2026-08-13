import type { Rect, Vec2 } from "../types";

/**
 * A prop is one sprite from the props atlas placed by its BOTTOM-CENTRE point.
 * Anchoring at the feet is what makes depth sorting work: the anchor y is both where
 * the object touches the floor and its sort key.
 */
export interface PropDef {
  sprite: string;
  x: number;
  y: number;
  flip?: boolean;
  /** Blocks movement. Uses an auto footprint unless `collider` is given. */
  solid?: boolean;
  /** Explicit floor footprint in world px, overriding the auto one. */
  collider?: Rect;
  /**
   * "ground" (rugs, floor markings) and "wall" (windows, clocks, the door) props are
   * baked into the static background - characters always walk over the former and in
   * front of the latter. "floor" props are depth sorted every frame.
   *
   * Ground props are placed by bottom-centre like everything else.
   */
  layer?: "wall" | "floor" | "ground";
  /** Draw order tiebreak for props sharing an anchor y. */
  bias?: number;
}

/**
 * A tagged patch of floor. Nothing consumes these yet - they exist so the little
 * interactions (sit in a chair, stand at the copier, drink coffee) can be added later
 * without reshaping the room format.
 */
export interface ZoneDef {
  id: string;
  rect: Rect;
  /** Shown as a prompt when a player stands inside. */
  label: string;
  /** Handler key the interaction system will dispatch on. */
  action: string;
}

/**
 * A rectangle of floor laid with a different carpet, snapped to the tile grid. Used to
 * mark out the break area and lounge without dropping rug sprites on the floor.
 */
export interface FloorZone {
  /** In tiles, relative to the top-left of the floor area (below the wall band). */
  tx: number;
  ty: number;
  tw: number;
  th: number;
  /** Sprite keys for the checkerboard pair. */
  tiles: [string, string];
}

export interface RoomDef {
  id: string;
  name: string;
  /** Floor area, in tiles. The wall band sits above it. */
  widthTiles: number;
  heightTiles: number;
  /** Height in px of the wall band drawn along the top edge. */
  wallHeight: number;
  floorZones?: FloorZone[];
  props: PropDef[];
  /** Extra invisible blockers, e.g. keeping players out of a doorway. */
  blockers?: Rect[];
  spawns: Vec2[];
  zones?: ZoneDef[];
}
