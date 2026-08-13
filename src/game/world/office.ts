import type { RoomDef } from "./types";

/**
 * The office. Four sections on one floor, in the order you would actually meet them.
 *
 * 176x448 world px. It used to be one 160x240 room that fitted on a phone screen all at
 * once, which was the right call when there was one desk in it - but "one room" and "an
 * office" are different things, and the room never felt like somewhere with a floor plan.
 * Now the camera travels, and walking from the lift to the meeting takes you past
 * everybody's desk, which is the point.
 *
 * Top to bottom:
 *
 *   RECEPTION    the lift, the fire stairs, a counter and two chairs to wait in
 *   OPEN PLAN    four desks, the printer, the wall of storage
 *   THE OFFICE   Colin's desk, the whiteboard, and a rug with chairs to talk on
 *   BREAK ROOM   coffee, water, and somewhere to stand while avoiding all of the above
 *
 * The doorways are deliberately staggered - right, left, right - so you weave through
 * the floor instead of walking down one straight line, and so each section reveals
 * itself as you come through the door rather than all at once.
 *
 * A NOTE ON WALLS. An interior wall is 32px of art standing on a 16px tile, so it covers
 * the tile behind it as well as its own. That is not a bug to design around: a character
 * is 40px, so somebody standing in that strip shows their head and shoulders over the
 * top of the partition, which is exactly what standing behind a wall looks like. What it
 * does mean is that furniture in the strip gets its top cropped, so nothing tall goes
 * within 32px above a wall's base line - the constants below are named for those lines
 * so the arithmetic is checkable rather than eyeballed.
 *
 * ART. LimeZu's "Modern Office - Revamped" for the furniture, with the doors from LimeZu's
 * "Modern Interiors" - Modern Office has 339 sprites in it and not one is a door. Both
 * are drawn from a higher angle than the characters are: you see the top of a desk but
 * you look a person in the eye. So furniture cannot cover a character to the chest the
 * way a front-elevation desk would, and what sells sitting is the arrangement rather than
 * the occlusion - chair behind, desk and monitor in front, character between the two.
 */

const WALL = 32; // one wallpaper band, cap and skirting included
const W = 11; // tiles across -> 176px
const H = 26; // tiles deep   -> 416px of floor, 448 with the wall band

/** Floor row `ty` runs from this y down. */
const row = (ty: number) => WALL + ty * 16;

/**
 * The base line of an interior wall standing on floor row `ty` - where it meets the
 * floor, and its depth sort key. Its art rises 32px from here, so keep anything tall
 * out of `base - 32 .. base`.
 */
const wallBase = (ty: number) => row(ty + 1);

const RECEPTION_WALL = 6; // between reception and the open plan
const PLAN_WALL = 14; // between the open plan and Colin's office
const BREAK_WALL = 21; // between Colin's office and the break room

export const office: RoomDef = {
  id: "office",
  name: "THE OFFICE",
  atlas: "office",
  widthTiles: W,
  heightTiles: H,
  wallHeight: WALL,
  wallTile: "wall_grey",
  groundTiles: ["floor_grey_a", "floor_grey_b"],

  /**
   * Interior walls. Gaps are offsets along the run, and each one gets a door prop below
   * so the opening reads as a doorway rather than as a hole. Staggered right, left,
   * right.
   */
  walls: [
    { tx: 0, ty: RECEPTION_WALL, len: W, dir: "h", gaps: [{ at: 7, len: 2 }] },
    { tx: 0, ty: PLAN_WALL, len: W, dir: "h", gaps: [{ at: 2, len: 2 }] },
    { tx: 0, ty: BREAK_WALL, len: W, dir: "h", gaps: [{ at: 6, len: 2 }] },
  ],

  floorZones: [
    // Reception is the one warm floor in the building, because it is the one part of an
    // office that is trying to make an impression on anybody.
    { tx: 0, ty: 0, tw: W, th: 6, tiles: ["floor_wood_a", "floor_wood_b"] },
    // The break room, in the colour every break room is.
    { tx: 0, ty: 22, tw: W, th: 4, tiles: ["floor_olive_a", "floor_olive_b"] },
    // A hemmed rug where the meeting happens. A tile swap here read as a rectangle
    // somebody had forgotten to finish; a rug with a visible edge says "this is a place".
    { tx: 5, ty: 17, tw: 4, th: 3, nine: "rug" },
  ],

  props: [
    /* ---- THE DOORWAYS ----------------------------------------------------------------
     * One door per gap, standing on the wall's own base line with a bias so it sorts
     * after the wall segments beside it and lands on the opening rather than behind it.
     * They swing as somebody walks up and shut again behind them; nothing about that
     * crosses the network, because every client works it out from positions it already
     * has (see doorFrame in the renderer).
     */
    { sprite: "door_tan", x: 120, y: wallBase(RECEPTION_WALL), door: true, bias: 1 },
    { sprite: "door_wood", x: 40, y: wallBase(PLAN_WALL), door: true, bias: 1 },
    { sprite: "door_red", x: 104, y: wallBase(BREAK_WALL), door: true, bias: 1 },

    /* ---- RECEPTION -----------------------------------------------------------------
     * The lift is two doors in the back wall that part as you walk up to them, which is
     * both what a lift looks like and, it turns out, the way out of the building. The
     * right leaf is mirrored so the pair opens outward from the middle.
     */
    { sprite: "door_cold", x: 72, y: WALL, door: true, bias: 1 },
    { sprite: "door_cold", x: 88, y: WALL, door: true, bias: 1, flip: true },
    { sprite: "door_exit", x: 24, y: WALL, door: true, bias: 1 },
    { sprite: "notice", x: 120, y: 26, layer: "wall" },
    { sprite: "picture", x: 148, y: 26, layer: "wall" },

    { sprite: "chair_office", x: 48, y: 80 },
    { sprite: "counter_white", x: 48, y: 100, solid: true, collider: { x: 34, y: 94, w: 28, h: 6 } },
    { sprite: "papers", x: 58, y: 98, bias: 6, takeable: true },
    { sprite: "plant_tall", x: 16, y: 72, takeable: true },
    // Two chairs to wait in, and something to ignore a magazine on.
    { sprite: "tub_chair_white", x: 136, y: 74 },
    { sprite: "tub_chair_grey", x: 136, y: 100 },
    { sprite: "side_table", x: 158, y: 88 },

    /* ---- OPEN PLAN -----------------------------------------------------------------
     * Four desks in two rows facing the same way, which is how open plan works and part
     * of why nobody likes it. Chairs anchor above their desk so they draw behind whoever
     * sits down; the desktop clutter needs a bias PAST the desk's own anchor or it sorts
     * underneath and disappears.
     */
    { sprite: "chair_office", x: 40, y: 170 },
    { sprite: "desk_grey", x: 40, y: 192, solid: true, collider: { x: 26, y: 186, w: 28, h: 6 } },
    { sprite: "monitor", x: 30, y: 186, bias: 7 },
    { sprite: "keyboard", x: 48, y: 190, bias: 5, takeable: true },

    { sprite: "chair_office", x: 128, y: 170 },
    { sprite: "desk_cream", x: 128, y: 192, solid: true, collider: { x: 114, y: 186, w: 28, h: 6 } },
    { sprite: "monitor_blue", x: 118, y: 186, bias: 7 },
    { sprite: "papers", x: 136, y: 190, bias: 5, takeable: true },

    { sprite: "chair_office", x: 40, y: 210 },
    { sprite: "desk", x: 40, y: 232, solid: true, collider: { x: 26, y: 226, w: 28, h: 6 } },
    { sprite: "monitor_blue", x: 30, y: 226, bias: 7 },
    { sprite: "keyboard", x: 48, y: 230, bias: 5, takeable: true },

    { sprite: "chair_office", x: 128, y: 210 },
    { sprite: "workstation", x: 128, y: 232, solid: true, collider: { x: 114, y: 226, w: 28, h: 6 } },
    { sprite: "monitor", x: 118, y: 226, bias: 7 },

    // The printer nobody wants to sit next to, and the storage everybody walks past.
    { sprite: "shelf_mesh_tall", x: 160, y: 180, solid: true },
    { sprite: "printer", x: 84, y: 232, solid: true },
    { sprite: "plant_bushy", x: 162, y: 228, takeable: true },

    /* ---- THE OFFICE ------------------------------------------------------------------
     * Colin's desk faces down the room, so whoever comes through the door is looked at
     * rather than looked away from. The whiteboard hangs on the face of the wall above -
     * anchored just below its base line so it sorts after the wall and lands on it.
     */
    { sprite: "whiteboard", x: 44, y: 276 },
    { sprite: "certificate", x: 104, y: 274 },
    { sprite: "certificate_2", x: 124, y: 274 },

    { sprite: "chair_office", x: 48, y: 300 },
    { sprite: "desk", x: 48, y: 322, solid: true, collider: { x: 34, y: 316, w: 28, h: 6 } },
    { sprite: "monitor", x: 38, y: 316, bias: 7 },
    { sprite: "keyboard", x: 56, y: 320, bias: 5, takeable: true },
    { sprite: "plant_small", x: 18, y: 330, takeable: true },

    // Where the meeting happens. Not solid on purpose: walking onto a chair is how you
    // sit down.
    { sprite: "tub_chair_grey", x: 98, y: 320 },
    { sprite: "tub_chair_tan", x: 132, y: 324 },
    { sprite: "side_table", x: 114, y: 344 },
    { sprite: "cabinet_tall", x: 20, y: 348, solid: true },
    { sprite: "board_stand", x: 164, y: 344, takeable: true },

    /* ---- BREAK ROOM ------------------------------------------------------------------ */
    { sprite: "counter_white", x: 44, y: 412, solid: true, collider: { x: 30, y: 406, w: 28, h: 6 } },
    { sprite: "coffee_station", x: 36, y: 410, bias: 8 },
    { sprite: "water_cooler", x: 84, y: 414, solid: true },
    { sprite: "tub_chair_pink", x: 122, y: 410 },
    { sprite: "tub_chair_white", x: 154, y: 414 },
    { sprite: "side_table", x: 138, y: 432 },
    { sprite: "plant_bushy", x: 16, y: 440, takeable: true },
  ],

  /**
   * Colin starts at his desk. Everybody else comes out of the lift and walks in, which
   * is how you arrive at an office and means the whole floor gets seen on the way to
   * saying hello. The seat sits above the desk's anchor so the desk sorts after the
   * character and covers their legs - see the note at the top of this file - and clear
   * of the desk's COLLIDER, which is a separate constraint and an easy one to miss:
   * a seat inside a collider is not a seat, it is a spot findFreeSpawn quietly shuffles
   * you out of, so Colin arrives standing beside his desk rather than at it.
   */
  seats: [{ id: "desk", x: 48, y: 314, dir: "down", kind: "lead" }],

  spawns: [
    // 0-1: out of the lift, facing into the building.
    { x: 72, y: 62 },
    { x: 96, y: 58 },
    // 2: back in from outside. Clear of the exit rect, or you would arrive, wait out the
    // exit cooldown and be sent straight back out without touching anything.
    { x: 80, y: 66 },
  ],
  joinSpawns: 2,

  // The lift is the way out of the building. It opens onto a wood, which nobody in the
  // office has ever remarked on.
  exits: [{ rect: { x: 64, y: WALL, w: 32, h: 10 }, to: "grove", spawn: 0, label: "TAKE THE LIFT" }],

  sayTriggers: [
    {
      phrases: [
        "lets go outside", "let's go outside", "go outside", "outside?",
        "wanna go outside", "to the grove", "take the lift",
      ],
      to: "grove",
      spawn: 0,
      announce: "{name} TOOK EVERYONE OUTSIDE",
    },
  ],

  zones: [
    { id: "lift", rect: { x: 60, y: WALL, w: 40, h: 22 }, label: "THE LIFT", action: "ride" },
    { id: "reception", rect: { x: 108, y: 62, w: 60, h: 48 }, label: "RECEPTION", action: "wait" },
    { id: "desk", rect: { x: 32, y: 310, w: 32, h: 16 }, label: "THE DESK", action: "sit" },
    { id: "chairs", rect: { x: 82, y: 306, w: 68, h: 24 }, label: "SIT DOWN", action: "sit" },
    { id: "coffee", rect: { x: 24, y: 396, w: 40, h: 20 }, label: "COFFEE", action: "drink" },
  ],
};
