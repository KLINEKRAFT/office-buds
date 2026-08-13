import type { Dir, Rect, Vec2 } from "../types";
import type { SeatKind } from "../cast";

/** Which atlas a room's art comes from. Rooms do not mix them. */
export type AtlasId = "office" | "village";

/**
 * A prop is one sprite from the room's atlas placed by its BOTTOM-CENTRE point.
 * Anchoring at the feet is what makes depth sorting work: the anchor y is both where
 * the object touches the ground and its sort key.
 */
export interface PropDef {
  sprite: string;
  x: number;
  y: number;
  flip?: boolean;
  /** Blocks movement. Uses an auto footprint unless `collider` is given. */
  solid?: boolean;
  /** Explicit ground footprint in world px, overriding the auto one. */
  collider?: Rect;
  /**
   * "ground" (rugs, road pieces) and "wall" (windows, clocks, the door) props are
   * baked into the static background - characters always walk over the former and in
   * front of the latter. "floor" props are depth sorted every frame.
   */
  layer?: "wall" | "floor" | "ground";
  /** Draw order tiebreak for props sharing an anchor y. */
  bias?: number;
}

/**
 * A patch of ground laid with different tiles, snapped to the tile grid. Used for the
 * office rug and for ponds and paths outdoors.
 */
export interface FloorZone {
  /** In tiles, relative to the top-left of the floor area (below any wall band). */
  tx: number;
  ty: number;
  tw: number;
  th: number;
  /** Sprite keys to pick between. One key means a flat fill. */
  tiles?: string[];
  /**
   * Lay the zone as a nine-slice instead, from `${nine}_tl` through `${nine}_br`. A
   * carpet swap reads as carpet laid differently, which is right for a break area and
   * wrong for a rug - a rug wants a hem you can see the edge of.
   */
  nine?: string;
  /** Blocks movement across the whole zone - water, mostly. */
  solid?: boolean;
}

/**
 * A tagged patch of floor. Interaction zones are carried for the small actions that
 * are still to come; exits are read by the game and move you to another room.
 */
export interface ZoneDef {
  id: string;
  rect: Rect;
  label: string;
  action: string;
}

export interface ExitDef {
  /** Standing here moves you (and only you) to `to`. */
  rect: Rect;
  to: string;
  /** Which spawn index to arrive on in the destination room. */
  spawn?: number;
  label: string;
}

/**
 * Saying something that contains one of these phrases moves EVERYONE in the room.
 * Walking through an exit moves only you; a spoken invitation takes the group, which
 * is the point of a game about two friends being in the same place.
 */
export interface SayTrigger {
  phrases: string[];
  to: string;
  spawn?: number;
  /** Shown to everyone. "{name}" is replaced with who said it. */
  announce: string;
}

/**
 * A place to sit. Seats work without any sitting animation: in this front-on
 * perspective a character parked slightly BEHIND a desk or sofa gets their legs covered
 * by it, leaving head and shoulders above the furniture - which is exactly what sitting
 * looks like from the front. So a seat is just a spot whose y sorts before the
 * furniture's, plus a facing.
 */
export interface SeatDef {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  /** Which kind of arrival lands here. */
  kind: SeatKind;
}

export interface RoomDef {
  id: string;
  name: string;
  atlas: AtlasId;
  /** Ground area, in tiles. Any wall band sits above it. */
  widthTiles: number;
  heightTiles: number;
  /** Height in px of the wall band along the top edge. 0 for outdoor rooms. */
  wallHeight: number;
  /** Which wallpaper the band is tiled from. Defaults to "wall". */
  wallTile?: string;
  /** Tile ranges where the band is cut away to leave a doorway. */
  wallGaps?: Array<{ tx: number; tw: number }>;
  /** Base ground tiles, picked per tile by a hash so no pattern emerges. */
  groundTiles: string[];
  floorZones?: FloorZone[];
  props: PropDef[];
  /** Extra invisible blockers, e.g. keeping players out of a doorway. */
  blockers?: Rect[];
  /**
   * Arrival points. Index 0..joinSpawns-1 are where a fresh player starts; the rest are
   * addressed by index from an exit or say-trigger, and are deliberately excluded from
   * the random pick because they sit right by a doorway - starting there meant a new
   * player could walk straight back out on their first input.
   */
  spawns: Vec2[];
  joinSpawns?: number;
  /** Where people start when the room has assigned places rather than a free floor. */
  seats?: SeatDef[];
  /**
   * Roughly how many world px should be visible vertically. Small rooms want a closer
   * camera than a big floor plan; leaving it unset uses the global default.
   */
  targetViewH?: number;
  zones?: ZoneDef[];
  exits?: ExitDef[];
  sayTriggers?: SayTrigger[];
  /** Ambient tint applied over the whole room, e.g. warm daylight outdoors. */
  tint?: { color: string; alpha: number };
}
