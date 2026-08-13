import type { PropDef, RoomDef, WallRun } from "./types";

/**
 * The office - the real one, from the floor plan.
 *
 * This is laid out from the architectural drawing of Colin's actual workplace: a ring
 * hallway around a central lift core, with the rooms hung off it where they really are.
 * Walk out of the lift, turn left, and the kitchen is where the kitchen is.
 *
 * WHAT IS FAITHFUL. The topology. Lift in the core, hallway wrapping it, hang out room
 * north-west, kitchen and bathrooms across the top, marketing north-east, Michael's
 * office off the west hallway, print room and shared workspace east, conference room
 * south. Somebody who works there should be able to navigate this without being told.
 *
 * WHAT IS NOT. The dimensions. The real floor is about a hundred feet square, which at
 * this game's scale is roughly 670x670 world px - and a phone shows 130x280 of that, so
 * you would see one twentieth of the building at a time. That is not a small problem, it
 * is the village mistake again: 480x384 of map, and everybody stood around talking off
 * each other's screens. So the corridors are shortened and the thirty-odd near-identical
 * perimeter offices are down to the few you actually walk past. 352x448 - about three
 * phone screens across and two down, big enough to be a building and small enough that
 * finding somebody is a walk rather than a search.
 *
 * Even so, a floor this size needs help the one-room office did not: the HUD names the
 * room you are standing in, anybody off-screen gets an arrow at the edge pointing at
 * them, and there is a button that pulls the camera back far enough to see the lot.
 *
 * THE GRID. Three columns and three bands, so every wall sits on a named line rather
 * than a number somebody guessed:
 *
 *          tx 0-4      5     6-15            16    17-21
 *   ty        WEST           MIDDLE                EAST
 *   0-5    hang out    |  kitchen |baths  |  marketing
 *   6      ------------+---------------- wall ----------------
 *   7-18   michael's   |  hallway ring    |  print room
 *          offices     |  around the core |  shared workspace
 *   19     ------------+---------------- wall ----------------
 *   20-25  offices     |  conference room |  offices
 *
 * A NOTE ON WALLS. A wall is 32px of art standing on a 16px tile, so it covers the tile
 * behind it as well as its own. A character is 40px, so somebody in that strip shows
 * their head and shoulders over the top, which is what standing behind a wall looks
 * like. Furniture there gets its top painted over, so nothing goes within 32px above a
 * wall's base line - and nothing goes in front of a doorway either. Both are checked in
 * tests/world.test.mjs, because both fail silently.
 */

const WALL = 32; // one wallpaper band, cap and skirting included
const W = 22; // tiles across -> 352px
const H = 26; // tiles deep   -> 416px of floor, 448 with the wall band

/** Top of floor row `ty`, in world px. */
const row = (ty: number) => WALL + ty * 16;
/** Middle of tile column `tx`. */
const col = (tx: number) => tx * 16 + 8;

/** The two full-height walls that divide the floor into three columns. */
const WEST_WALL = 5;
const EAST_WALL = 16;
/** The two full-width walls that divide it into three bands. */
const NORTH_WALL = 6;
const SOUTH_WALL = 19;

/**
 * The lift core: sealed, unreachable, with the lift doors on the face you can see.
 *
 * Its north and south walls set how deep the horizontal corridors have to be. A wall is
 * 32px of art on a 16px tile, so it covers the row behind it - which means a two-row
 * corridor has one row you can walk down and cannot see yourself in. Three rows, one
 * lost to the wall, two left: that is why the hallway is the depth it is, north and
 * south, and why the vertical stretches are only two - a vertical wall is 16px wide and
 * occludes nothing beside it.
 */
const CORE = { x0: 8, y0: 10, x1: 13, y1: 15 };

const walls: WallRun[] = [
  // ---- the three-by-three grid ------------------------------------------------------
  // Doorways are staggered rather than lined up, so you turn a corner between rooms
  // instead of seeing down the whole floor from the lift.
  {
    tx: WEST_WALL,
    ty: 0,
    len: H,
    dir: "v",
    gaps: [
      { at: 2, len: 2 }, // hang out room -> kitchen
      { at: 9, len: 2 }, // michael's office -> west hallway
      { at: 15, len: 2 }, // the west offices -> west hallway
      { at: 22, len: 2 }, // the south-west offices -> conference room
    ],
  },
  {
    tx: EAST_WALL,
    ty: 0,
    len: H,
    dir: "v",
    gaps: [
      { at: 2, len: 2 }, // bathrooms -> marketing
      { at: 8, len: 2 }, // print room -> east hallway
      { at: 14, len: 2 }, // shared workspace -> east hallway
      { at: 22, len: 2 }, // conference room -> the south-east offices
    ],
  },
  {
    tx: 0,
    ty: NORTH_WALL,
    len: W,
    dir: "h",
    gaps: [
      { at: 2, len: 2 }, // hang out room -> michael's office
      { at: 10, len: 2 }, // kitchen -> the hallway
      { at: 19, len: 2 }, // marketing -> print room
    ],
  },
  {
    tx: 0,
    ty: SOUTH_WALL,
    len: W,
    dir: "h",
    gaps: [
      { at: 2, len: 2 }, // west offices -> south-west offices
      { at: 10, len: 2 }, // the hallway -> conference room
      { at: 19, len: 2 }, // shared workspace -> south-east offices
    ],
  },

  // ---- inside the bands ---------------------------------------------------------------
  // Kitchen from bathrooms. One tile short of the north wall on purpose: run it the
  // full depth and its last tile lands square on top of the kitchen's doorway onto the
  // hallway, halving a two-tile opening.
  { tx: 11, ty: 0, len: NORTH_WALL - 1, dir: "v", gaps: [{ at: 4, len: 1 }] },
  // Michael's office from the offices below it.
  { tx: 0, ty: 13, len: WEST_WALL, dir: "h", gaps: [{ at: 1, len: 2 }] },
  // Print room from the shared workspace.
  { tx: EAST_WALL + 1, ty: 12, len: W - EAST_WALL - 1, dir: "h", gaps: [{ at: 2, len: 2 }] },

  // ---- the core -----------------------------------------------------------------------
  // Sealed on all four sides: it is a lift shaft and a stairwell, not a room. The dark
  // floor inside is its roof, which is all you would see of it from out here anyway.
  { tx: CORE.x0, ty: CORE.y0, len: CORE.x1 - CORE.x0 + 1, dir: "h" },
  { tx: CORE.x0, ty: CORE.y1, len: CORE.x1 - CORE.x0 + 1, dir: "h" },
  { tx: CORE.x0, ty: CORE.y0 + 1, len: CORE.y1 - CORE.y0 - 1, dir: "v" },
  { tx: CORE.x1, ty: CORE.y0 + 1, len: CORE.y1 - CORE.y0 - 1, dir: "v" },
];

/** A desk with a chair behind it and a screen on it, which is most of this building. */
function workstation(
  x: number,
  y: number,
  opts: { desk?: string; screen?: string; extra?: string } = {},
): PropDef[] {
  const { desk = "desk", screen = "monitor", extra } = opts;
  const props: PropDef[] = [
    // The chair anchors above the desk so it draws behind whoever sits down; the screen
    // needs a bias PAST the desk's own anchor or it sorts underneath and disappears.
    { sprite: "chair_office", x, y: y - 22 },
    { sprite: desk, x, y, solid: true, collider: { x: x - 14, y: y - 6, w: 28, h: 6 } },
    { sprite: screen, x: x - 10, y: y - 6, bias: 7 },
  ];
  if (extra) props.push({ sprite: extra, x: x + 8, y: y - 2, bias: 5, takeable: true });
  return props;
}

/** Two armchairs and a table, which is most of the rest of it. */
function lounge(x: number, y: number, left = "tub_chair_grey", right = "tub_chair_tan"): PropDef[] {
  return [
    { sprite: left, x: x - 18, y },
    { sprite: right, x: x + 18, y: y + 4 },
    { sprite: "side_table", x, y: y + 18 },
  ];
}

export const office: RoomDef = {
  id: "office",
  name: "THE OFFICE",
  atlas: "office",
  widthTiles: W,
  heightTiles: H,
  wallHeight: WALL,
  wallTile: "wall_grey",
  groundTiles: ["floor_grey_a", "floor_grey_b"],
  walls,

  floorZones: [
    // The hallway ring is the one floor everybody crosses, so it gets its own colour and
    // the rooms read as rooms rather than as more corridor.
    { tx: 6, ty: 7, tw: 10, th: 12, tiles: ["floor_dark_a", "floor_dark_b"] },
    // The core's roof, inside its sealed walls.
    {
      tx: CORE.x0 + 1,
      ty: CORE.y0 + 1,
      tw: CORE.x1 - CORE.x0 - 1,
      th: CORE.y1 - CORE.y0 - 1,
      tiles: ["floor_dark_b"],
    },
    // The kitchen's dark tile, which is the one floor in the building anybody remembers.
    { tx: 6, ty: 0, tw: 5, th: 6, tiles: ["floor_dark_a", "floor_dark_b"] },
    // The hang out room is carpeted; marketing and the conference room keep the wood.
    { tx: 0, ty: 0, tw: WEST_WALL, th: 6, tiles: ["floor_red_a", "floor_red_b"] },
    { tx: 6, ty: 20, tw: 10, th: 6, tiles: ["floor_wood_a", "floor_wood_b"] },
    { tx: EAST_WALL + 1, ty: 0, tw: W - EAST_WALL - 1, th: 6, tiles: ["floor_wood_a", "floor_wood_b"] },
    // A rug where the hang out room actually hangs out.
    { tx: 1, ty: 2, tw: 3, th: 3, nine: "rug" },
  ],

  props: [
    /* ---- THE CORE, AND THE WAY OUT ---------------------------------------------------
     * The lift is two doors in the south face of the core, which is the face you see
     * coming down the hallway - and, this being a game, the way out of the building. The
     * right leaf is mirrored so the pair opens from the middle.
     */
    { sprite: "door_cold", x: col(10), y: row(CORE.y1 + 1), door: true, bias: 1 },
    { sprite: "door_cold", x: col(11), y: row(CORE.y1 + 1), door: true, bias: 1, flip: true },

    /* ---- doors in the doorways --------------------------------------------------------
     * One per opening, standing on its wall's base line with a bias so it sorts after the
     * wall beside it. They swing as somebody walks up and shut behind them, and none of
     * it crosses the network - every screen works it out from positions it already has.
     */
    { sprite: "door_tan", x: col(2), y: row(NORTH_WALL + 1), door: true, bias: 1 },
    { sprite: "door_wood", x: col(10), y: row(NORTH_WALL + 1), door: true, bias: 1 },
    { sprite: "door_tan", x: col(19), y: row(NORTH_WALL + 1), door: true, bias: 1 },
    { sprite: "door_red", x: col(2), y: row(SOUTH_WALL + 1), door: true, bias: 1 },
    { sprite: "door_wood", x: col(10), y: row(SOUTH_WALL + 1), door: true, bias: 1 },
    { sprite: "door_red", x: col(19), y: row(SOUTH_WALL + 1), door: true, bias: 1 },

    /* ---- HANG OUT ROOM (north-west) ----------------------------------------------------
     * Armchairs round a low table, a television on the wall, and no desk in it - the one
     * room in the building without one.
     */
    // The hang out room has a doorway on two of its four sides, so the only wall the
    // shelf can stand against is the top one. Anywhere else and it reached into an
    // opening - it is 27px of collider in an 80px room.
    { sprite: "shelf_mesh", x: col(1), y: row(1), solid: true },
    { sprite: "whiteboard", x: col(3) + 4, y: row(0) + 12 },
    ...lounge(col(2), row(3), "tub_chair_white", "tub_chair_pink"),
    { sprite: "plant_tall", x: col(0), y: row(5), takeable: true },

    /* ---- KITCHEN (north, middle) -------------------------------------------------------- */
    {
      sprite: "counter_white",
      x: col(7),
      y: row(1),
      solid: true,
      collider: { x: col(7) - 14, y: row(1) - 6, w: 28, h: 6 },
    },
    { sprite: "coffee_station", x: col(6), y: row(1) - 2, bias: 8 },
    { sprite: "cabinet_white", x: col(9), y: row(1) },
    { sprite: "water_cooler", x: col(9), y: row(4), solid: true },
    { sprite: "side_table", x: col(8), y: row(4) },
    { sprite: "chair_blue", x: col(8) - 16, y: row(4) - 2 },
    { sprite: "chair_red", x: col(8) + 16, y: row(4) - 2 },

    /* ---- BATHROOMS (north, middle-right) ------------------------------------------------
     * Two doors and a plant. Nobody needs to go in; they are here because they are on the
     * plan, and a floor with no bathrooms on it does not read as a floor.
     */
    { sprite: "door_wc", x: col(13), y: WALL, door: true, bias: 1 },
    { sprite: "door_wc", x: col(14), y: WALL, door: true, bias: 1, flip: true },
    { sprite: "plant_small", x: col(15), y: row(5), takeable: true },

    /* ---- MARKETING (north-east) ----------------------------------------------------------
     * Desks against the navy wall, the armchairs by the window. Colin sits here.
     */
    { sprite: "photo_group", x: col(19), y: row(0) + 10 },
    // Both desks on the same column, leaving a walkway up the left of the room. Three
    // desks fitted, and left a four pixel gap between two of them - which is narrower
    // than a person, so the top of the room and Colin's own chair were sealed off behind
    // a wall of furniture. The flood fill in tests/world.test.mjs is what found it.
    ...workstation(col(19), row(2), { desk: "desk_grey", screen: "monitor_blue", extra: "keyboard" }),
    ...workstation(col(19), row(5), { desk: "desk", screen: "monitor", extra: "papers" }),
    { sprite: "plant_bushy", x: col(21), y: row(4) + 8, takeable: true },

    /* ---- MICHAEL'S OFFICE (west, off the hallway) ------------------------------------- */
    { sprite: "certificate", x: col(1), y: row(7) + 10 },
    { sprite: "certificate_2", x: col(3), y: row(7) + 10 },
    ...workstation(col(2), row(11), { desk: "desk", screen: "monitor", extra: "keyboard" }),
    { sprite: "tub_chair_grey", x: col(4), y: row(12) },

    /* ---- THE WEST OFFICES -------------------------------------------------------------- */
    ...workstation(col(2), row(17), { desk: "desk_grey", screen: "monitor_blue" }),
    { sprite: "printer", x: col(1), y: row(17) + 12, solid: true },
    { sprite: "plant_small", x: col(4), y: row(17) + 12, takeable: true },

    /* ---- PRINT ROOM (east, off the hallway) -------------------------------------------- */
    { sprite: "copier", x: col(18), y: row(8), solid: true },
    { sprite: "printer_big", x: col(21), y: row(9), solid: true },
    { sprite: "shelf_mesh_wide", x: col(19), y: row(11), solid: true },
    { sprite: "papers", x: col(21), y: row(10), takeable: true },

    /* ---- SHARED WORKSPACE (east, below the print room) ----------------------------------- */
    ...workstation(col(21) - 8, row(17), { desk: "workstation", screen: "monitor", extra: "keyboard" }),
    ...workstation(col(19), row(15), { desk: "desk_cream", screen: "monitor_blue" }),
    { sprite: "shelf_mesh_tall", x: col(17), y: row(17) + 12, solid: true },
    { sprite: "board_stand", x: col(20), y: row(17) + 12, takeable: true },

    /* ---- CONFERENCE ROOM (south, middle) --------------------------------------------------
     * The long table, the screen at the head of it, and the chairs nobody sits in the
     * same way twice.
     */
    { sprite: "whiteboard", x: col(13), y: row(20) + 10 },
    { sprite: "chair_office", x: col(8), y: row(22) },
    { sprite: "chair_office", x: col(13), y: row(22) },
    {
      sprite: "desk",
      x: col(9),
      y: row(23),
      solid: true,
      collider: { x: col(9) - 14, y: row(23) - 6, w: 28, h: 6 },
    },
    {
      sprite: "desk",
      x: col(12),
      y: row(23),
      solid: true,
      collider: { x: col(12) - 14, y: row(23) - 6, w: 28, h: 6 },
    },
    { sprite: "chair_blue", x: col(8), y: row(25) + 8 },
    { sprite: "chair_red", x: col(11), y: row(25) + 8 },
    { sprite: "chair_blue", x: col(14), y: row(25) + 8 },
    { sprite: "plant_tall", x: col(7), y: row(24), takeable: true },

    /* ---- THE SOUTH OFFICES ------------------------------------------------------------- */
    ...workstation(col(2), row(23), { desk: "desk_cream", screen: "monitor_blue" }),
    ...workstation(col(19), row(23), { desk: "desk_grey", screen: "monitor", extra: "papers" }),
    { sprite: "plant_bushy", x: col(4), y: row(25) + 8, takeable: true },
    { sprite: "cabinet_olive", x: col(17), y: row(25) + 8, solid: true },
  ],

  /**
   * Colin lands at his desk in marketing. Everybody else comes out of the lift into the
   * hallway and walks the floor to find him, which is how arriving at an office works and
   * means the building gets seen on the way to saying hello.
   *
   * The seat is above the desk's anchor so the desk sorts after the character and covers
   * their legs, and clear of the desk's COLLIDER, which is a separate constraint and an
   * easy one to miss: a seat inside a collider is a spot findFreeSpawn quietly shuffles
   * you out of, so you arrive standing beside your desk rather than at it.
   */
  seats: [{ id: "marketing_desk", x: col(19), y: row(2) - 8, dir: "down", kind: "lead" }],

  spawns: [
    // 0-1: out of the lift, in the south hallway.
    { x: col(10), y: row(17) + 8 },
    { x: col(12), y: row(17) + 8 },
    // 2: back in from outside. Clear of the exit rect, or you would arrive, wait out the
    // exit cooldown, and be walked straight back out without touching anything.
    { x: col(11), y: row(17) + 14 },
  ],
  joinSpawns: 2,

  // A little further back than the default: in a building this size a close camera loses
  // the room you are standing in.
  targetViewH: 250,

  exits: [
    {
      rect: { x: col(10) - 16, y: row(CORE.y1 + 1), w: 32, h: 10 },
      to: "grove",
      spawn: 0,
      label: "TAKE THE LIFT",
    },
  ],

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

  /**
   * Every room on the plan, as a named area. The HUD reads these to say where you are
   * standing, which is most of what makes a building this size navigable - and it is
   * what the `zones` array has been carried for since the beginning.
   *
   * Order matters: the first match wins, so the small specific areas come before the
   * large ones they sit inside.
   */
  zones: [
    { id: "lift", rect: { x: col(10) - 20, y: row(17), w: 40, h: 24 }, label: "THE LIFT", action: "ride" },
    { id: "hangout", rect: { x: 0, y: row(0), w: WEST_WALL * 16, h: 6 * 16 }, label: "HANG OUT ROOM", action: "sit" },
    { id: "kitchen", rect: { x: 6 * 16, y: row(0), w: 5 * 16, h: 6 * 16 }, label: "KITCHEN", action: "drink" },
    { id: "bathrooms", rect: { x: 12 * 16, y: row(0), w: 4 * 16, h: 6 * 16 }, label: "BATHROOMS", action: "wait" },
    {
      id: "marketing",
      rect: { x: (EAST_WALL + 1) * 16, y: row(0), w: (W - EAST_WALL - 1) * 16, h: 6 * 16 },
      label: "MARKETING",
      action: "sit",
    },
    { id: "michaels", rect: { x: 0, y: row(7), w: WEST_WALL * 16, h: 6 * 16 }, label: "MICHAEL'S OFFICE", action: "sit" },
    { id: "west_offices", rect: { x: 0, y: row(14), w: WEST_WALL * 16, h: 5 * 16 }, label: "THE OFFICES", action: "sit" },
    {
      id: "printroom",
      rect: { x: (EAST_WALL + 1) * 16, y: row(7), w: (W - EAST_WALL - 1) * 16, h: 5 * 16 },
      label: "PRINT ROOM",
      action: "use",
    },
    {
      id: "workspace",
      rect: { x: (EAST_WALL + 1) * 16, y: row(13), w: (W - EAST_WALL - 1) * 16, h: 6 * 16 },
      label: "SHARED WORKSPACE",
      action: "sit",
    },
    { id: "conference", rect: { x: 6 * 16, y: row(20), w: 10 * 16, h: 6 * 16 }, label: "CONFERENCE ROOM", action: "sit" },
    { id: "south_offices", rect: { x: 0, y: row(20), w: WEST_WALL * 16, h: 6 * 16 }, label: "THE OFFICES", action: "sit" },
    {
      id: "southeast_offices",
      rect: { x: (EAST_WALL + 1) * 16, y: row(20), w: (W - EAST_WALL - 1) * 16, h: 6 * 16 },
      label: "THE OFFICES",
      action: "sit",
    },
    { id: "hallway", rect: { x: 6 * 16, y: row(7), w: 10 * 16, h: 12 * 16 }, label: "THE HALLWAY", action: "walk" },
  ],
};
