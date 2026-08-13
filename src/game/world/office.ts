import type { RoomDef } from "./types";

/**
 * The office. One room, one desk, one place to sit and talk.
 *
 * 160x240 world px. Both numbers are chosen against a portrait phone rather than picked
 * for looks: at the scale this game runs, a phone shows roughly 130x220 world px, so a
 * room this size is almost entirely on screen at once and the camera only ever drifts a
 * few pixels. Nothing important is ever off-frame.
 *
 * Laid out like a real one. Desk against the back wall so whoever sits there looks down
 * the room at anyone coming in; doorway top-right, so nobody ever arrives from behind
 * the desk; visitor chairs on a rug just to the right and a little nearer the viewer;
 * storage down the left wall; the coffee and water in the far corner, which is where
 * people stand around in every office ever built.
 *
 * ART. LimeZu's "Modern Office - Revamped" (art-source/modern-office/). It is drawn from
 * a higher angle than the characters are - you see the top of a desk but you look a
 * person in the eye - so furniture cannot cover a character to the chest the way a
 * front-elevation desk would. What sells sitting here is the arrangement rather than the
 * occlusion: chair behind, desk and monitor in front, and the character between them.
 * That is exactly how the pack's own example rooms read, and it works.
 */

const WALL = 32; // one wallpaper band, cap and skirting included
const W = 10; // tiles across -> 160px
const H = 13; // tiles deep   -> 208px of floor, 240 with the wall band

export const office: RoomDef = {
  id: "office",
  name: "THE OFFICE",
  atlas: "office",
  widthTiles: W,
  heightTiles: H,
  wallHeight: WALL,
  wallTile: "wall_grey",
  // The doorway, top right. Two tiles of unlit opening rather than a door sprite.
  wallGaps: [{ tx: 7, tw: 2 }],
  groundTiles: ["floor_grey_a", "floor_grey_b"],

  floorZones: [
    // One floor, one rug. An earlier pass zoned the desk end in a second carpet and it
    // read as a rectangle someone had forgotten to finish rather than as a different
    // floor - a hemmed rug says "this is a place" and a hard-edged tile swap does not.
    { tx: 4, ty: 5, tw: 4, th: 3, nine: "rug" },
  ],

  props: [
    // ---- the wall you look at ------------------------------------------------------
    { sprite: "whiteboard", x: 36, y: 28, layer: "wall" },
    { sprite: "photo_group", x: 74, y: 26, layer: "wall" },
    { sprite: "certificate", x: 100, y: 26, layer: "wall" },

    // ---- the desk ------------------------------------------------------------------
    // Chair behind, desk in front, screen and keyboard on top. The chair anchors above
    // the seat so it draws behind whoever is sitting; the desk anchors below so it draws
    // in front of them. The desktop clutter needs a bias PAST the desk's own anchor or
    // it sorts behind the desk and vanishes underneath it.
    { sprite: "chair_office", x: 40, y: 74 },
    { sprite: "desk", x: 40, y: 96, solid: true, collider: { x: 26, y: 90, w: 28, h: 6 } },
    { sprite: "monitor", x: 30, y: 90, bias: 7 },
    { sprite: "keyboard", x: 46, y: 94, bias: 5, takeable: true },
    { sprite: "plant_tall", x: 12, y: 86, takeable: true },

    // ---- left wall: storage, and the printer nobody wants to sit next to ------------
    { sprite: "locker_mesh", x: 14, y: 132, solid: true },
    { sprite: "shelf_mesh", x: 22, y: 168, solid: true },
    { sprite: "copier", x: 16, y: 206, solid: true },
    { sprite: "printer", x: 48, y: 210, solid: true },
    { sprite: "plant_bushy", x: 14, y: 234, takeable: true },

    // ---- where the meeting happens -------------------------------------------------
    // Not solid on purpose: walking onto a chair is how you sit down.
    { sprite: "side_table", x: 100, y: 140, solid: true },
    { sprite: "tub_chair_grey", x: 80, y: 124 },
    { sprite: "tub_chair_tan", x: 120, y: 128 },
    { sprite: "plant_small", x: 146, y: 112, takeable: true },

    // ---- the far corner, where everyone stands around ------------------------------
    { sprite: "counter_white", x: 124, y: 186, solid: true },
    { sprite: "coffee_station", x: 116, y: 184, bias: 6 },
    { sprite: "water_cooler", x: 148, y: 212, solid: true },
    { sprite: "board_stand", x: 88, y: 206, takeable: true },
  ],

  /**
   * Seats. Each sits a little above its furniture's anchor so the furniture sorts after
   * the character and covers their feet - see the note at the top of this file.
   *   desk       is drawn from 77, chair from 53, so sitting at 92 puts the character
   *              between the two with the monitor at their chest.
   *   tub chairs are 18px tall, so a seat 4px above the anchor tucks the legs in.
   */
  seats: [
    { id: "desk", x: 40, y: 92, dir: "down", kind: "desk" },
    { id: "chair_left", x: 80, y: 120, dir: "down", kind: "sofa" },
    { id: "chair_right", x: 120, y: 124, dir: "down", kind: "sofa" },
  ],

  spawns: [
    { x: 74, y: 176 },
    { x: 54, y: 160 },
    // Index 2: just inside the doorway, for coming back in from outside.
    { x: 120, y: 58 },
  ],
  joinSpawns: 2,

  exits: [
    { rect: { x: 112, y: WALL, w: 32, h: 10 }, to: "outside", spawn: 0, label: "GO OUTSIDE" },
  ],

  sayTriggers: [
    {
      phrases: ["lets go outside", "let's go outside", "go outside", "outside?", "wanna go outside"],
      to: "outside",
      spawn: 0,
      announce: "{name} TOOK EVERYONE OUTSIDE",
    },
  ],

  zones: [
    { id: "desk", rect: { x: 24, y: 84, w: 32, h: 16 }, label: "THE DESK", action: "sit" },
    { id: "chairs", rect: { x: 68, y: 112, w: 60, h: 20 }, label: "SIT DOWN", action: "sit" },
    { id: "coffee", rect: { x: 108, y: 172, w: 32, h: 18 }, label: "COFFEE", action: "drink" },
  ],
};
