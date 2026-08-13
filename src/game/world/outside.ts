import type { RoomDef } from "./types";

/**
 * Outside.
 *
 * You leave a beige office through a fire door and you are standing in a medieval
 * village, and nobody acknowledges this. That is the joke, and the room is built to
 * sell it by playing completely straight: a proper crossroads, a well, a market stall,
 * a treasure chest nobody has opened, and a wraith loitering by the trees.
 *
 * The way back in is the stone cottage - the office is, apparently, inside it.
 *
 * Layout is a crossroads dividing the map into four quadrants: cottage top-left, pond
 * and market top-right, woods bottom-left, and the treasure corner bottom-right. Trees
 * line the perimeter so the space reads as a clearing rather than grass running off the
 * edge of the world.
 */

const W = 30; // tiles
const H = 24;

export const outside: RoomDef = {
  id: "outside",
  name: "OUTSIDE",
  atlas: "village",
  widthTiles: W,
  heightTiles: H,
  wallHeight: 0,

  // 16 crops of the source grass, picked per tile by hash so no repeat is visible.
  groundTiles: [
    "grass_0", "grass_1", "grass_2", "grass_3", "grass_4", "grass_5", "grass_6", "grass_7",
    "grass_8", "grass_9", "grass_10", "grass_11", "grass_12", "grass_13", "grass_14", "grass_15",
  ],

  floorZones: [
    // Crossroads, laid in cobblestone.
    { tx: 14, ty: 0, tw: 3, th: H, tiles: ["path_0", "path_1", "path_2", "path_3"] },
    { tx: 0, ty: 13, tw: W, th: 3, tiles: ["path_0", "path_1", "path_2", "path_3"] },
    // Pond, top right. Solid, so you can walk around it but not into it.
    { tx: 21, ty: 2, tw: 7, th: 5, tiles: ["water_0", "water_1", "water_2", "water_3"], solid: true },
  ],

  props: [
    // ---- perimeter woods ----------------------------------------------------
    { sprite: "oak_tree", x: 30, y: 58, solid: true },
    { sprite: "oak_tree", x: 100, y: 48, solid: true },
    { sprite: "oak_tree", x: 186, y: 56, solid: true },
    { sprite: "oak_tree", x: 24, y: 132, solid: true },
    { sprite: "oak_tree", x: 26, y: 196, solid: true },
    { sprite: "oak_tree", x: 36, y: 302, solid: true },
    { sprite: "oak_tree", x: 104, y: 336, solid: true },
    { sprite: "oak_tree", x: 178, y: 302, solid: true },
    { sprite: "oak_tree", x: 330, y: 322, solid: true },
    { sprite: "oak_tree", x: 424, y: 300, solid: true },
    { sprite: "oak_tree", x: 466, y: 356, solid: true },
    { sprite: "oak_tree", x: 468, y: 150, solid: true },
    { sprite: "oak_tree", x: 300, y: 44, solid: true },

    // ---- the cottage, which is somehow the office ---------------------------
    { sprite: "cottage", x: 120, y: 150, solid: true },
    { sprite: "barrel", x: 176, y: 152, takeable: true },
    { sprite: "bush", x: 74, y: 156 },
    { sprite: "lamp_post", x: 196, y: 196 },

    // ---- market corner --------------------------------------------------------
    { sprite: "market_stall", x: 320, y: 180, solid: true },
    { sprite: "barrel", x: 356, y: 184 },
    { sprite: "barrel", x: 372, y: 180 },
    { sprite: "crystal_orb", x: 292, y: 176, bias: 20, takeable: true },
    { sprite: "staff", x: 350, y: 152, takeable: true },
    { sprite: "shield", x: 296, y: 196, takeable: true },
    { sprite: "boulder", x: 452, y: 150 },
    { sprite: "bush", x: 420, y: 196 },

    // ---- crossroads ------------------------------------------------------------
    { sprite: "well", x: 300, y: 288, solid: true },
    { sprite: "lamp_post", x: 286, y: 258 },
    { sprite: "bush", x: 208, y: 262 },
    { sprite: "mushroom", x: 196, y: 236, takeable: true },

    // ---- woods, bottom left ------------------------------------------------------
    { sprite: "rogue", x: 78, y: 268 },
    { sprite: "mushroom", x: 52, y: 240 },
    { sprite: "mushroom", x: 140, y: 288 },
    { sprite: "boulder", x: 150, y: 358 },
    { sprite: "bush", x: 62, y: 360 },
    { sprite: "bush", x: 200, y: 348 },

    // ---- treasure corner, bottom right --------------------------------------------
    { sprite: "sword", x: 396, y: 252, takeable: true },
    { sprite: "chest_open", x: 428, y: 262 },
    { sprite: "gold_pile", x: 446, y: 266, takeable: true },
    { sprite: "chest_closed", x: 362, y: 300 },
    { sprite: "boulder", x: 392, y: 344 },
    { sprite: "mushroom", x: 452, y: 322 },
    { sprite: "bush", x: 300, y: 360 },

    // ---- a wraith, loitering, unremarked upon ---------------------------------------
    { sprite: "wraith", x: 62, y: 96 },
  ],

  // Arriving from the office puts you on the path below the cottage door.
  spawns: [
    { x: 120, y: 184 },
    { x: 152, y: 192 },
    { x: 240, y: 236 },
  ],
  joinSpawns: 2,

  // Walking back into the cottage returns you to the office, on its door spawn.
  exits: [{ rect: { x: 104, y: 152, w: 32, h: 10 }, to: "office", spawn: 2, label: "GO INSIDE" }],

  sayTriggers: [
    {
      phrases: [
        "lets go inside", "let's go inside", "go inside", "back to work",
        "back inside", "lets go back", "let's go back",
      ],
      to: "office",
      spawn: 2,
      announce: "{name} MARCHED EVERYONE BACK INSIDE",
    },
  ],

  zones: [
    { id: "well", rect: { x: 284, y: 288, w: 32, h: 20 }, label: "WISHING WELL", action: "wish" },
    { id: "market", rect: { x: 296, y: 180, w: 48, h: 20 }, label: "MARKET STALL", action: "browse" },
    { id: "chest", rect: { x: 414, y: 262, w: 30, h: 18 }, label: "OPEN CHEST", action: "loot" },
  ],
};
