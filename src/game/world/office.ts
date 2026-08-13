import type { RoomDef } from "./types";

/**
 * The manager's office. One room, one desk, one place to sit and talk.
 *
 * 144x240 world px. Both numbers are chosen against a portrait phone rather than picked
 * for looks: at the scale this game runs, a phone shows roughly 130x220 world px, so a
 * room this size is almost entirely on screen at once and the camera only ever drifts a
 * few pixels. Nothing important is ever off-frame, and there is no expanse of empty
 * carpet in the corner of the picture doing nothing.
 *
 * Laid out like a real one. Desk against the window wall so the manager looks down the
 * room at whoever walks in; door top-right, so nobody ever enters from behind the desk;
 * visitor seating on a rug just to the right and a little nearer the viewer; storage
 * down both walls. The manager and their visitor end up about 50px apart across and 35
 * down - close enough to share a phone screen, far enough that they read as two people
 * in a meeting rather than one person standing on another.
 *
 * SEATING WITHOUT SITTING ART. Nobody has a sitting animation, and none is needed. In
 * this front-on perspective, furniture drawn OVER a character's legs reads as sitting
 * behind it, so each seat sits a few px ABOVE its furniture's anchor: the desk or sofa
 * then sorts after the character and covers them from the waist down, leaving head and
 * shoulders showing. The sofas are deliberately NOT solid, so this is something you can
 * do on purpose - walk onto a sofa and you are sitting on it.
 */

const WALL = 48;
const W = 9; // tiles across  -> 144px
const H = 12; // tiles deep   -> 192px of floor, 240 with the wall band

export const office: RoomDef = {
  id: "office",
  name: "THE OFFICE",
  atlas: "office",
  widthTiles: W,
  heightTiles: H,
  wallHeight: WALL,
  groundTiles: ["floor_a", "floor_b"],

  floorZones: [
    // The rug the meeting happens on. Sized to the furniture rather than to the floor:
    // the sofa sits on its back edge and the table on its front hem, so the three
    // pieces read as one arrangement instead of three things near each other.
    { tx: 4, ty: 5, tw: 4, th: 3, nine: "rug" },
  ],

  props: [
    // ---- the wall you look at ----------------------------------------------------
    { sprite: "wall_clock", x: 14, y: 38, layer: "wall" },
    { sprite: "window", x: 46, y: 40, layer: "wall" },
    { sprite: "window", x: 80, y: 40, layer: "wall" },
    { sprite: "board", x: 108, y: 36, layer: "wall" },
    { sprite: "door", x: 126, y: WALL, layer: "wall" },

    // ---- the desk, under the window ------------------------------------------------
    // The pack's boss_desk is a dark slab that vanished against the carpet. This desk
    // carries a monitor and a keyboard, so it reads as a desk instantly, and at 28px
    // tall it crosses the manager at chest height - which is what someone sat at their
    // desk actually looks like from the front.
    // The collider is the desk's front lip only, not the auto footprint. The manager has
    // to stand deep enough into the desk that its surface crosses their chest, which the
    // default (four tenths of the sprite) would not let them do.
    { sprite: "boss_chair", x: 44, y: 92 },
    { sprite: "desk", x: 44, y: 120, solid: true, collider: { x: 30, y: 114, w: 28, h: 6 } },
    { sprite: "filing_cabinet_small", x: 68, y: 118, solid: true },

    // ---- left wall: storage, then the printer nobody wants to stand next to --------
    { sprite: "tall_bookshelf", x: 12, y: 112, solid: true },
    { sprite: "filing_cabinet_tall", x: 12, y: 150, solid: true },
    { sprite: "printer_furniture", x: 22, y: 196, solid: true },
    { sprite: "big_plant", x: 16, y: 236, solid: true },

    // ---- where the meeting happens --------------------------------------------------
    // Not solid on purpose: walking onto a sofa is how you sit down.
    { sprite: "big_sofa", x: 90, y: 148 },
    { sprite: "small_sofa", x: 114, y: 170, flip: true },
    { sprite: "small_table", x: 90, y: 172, solid: true },

    // ---- right wall -------------------------------------------------------------------
    { sprite: "coffee_machine", x: 124, y: 84 },
    { sprite: "wide_filing_cabinet", x: 124, y: 108, solid: true },
    { sprite: "small_plant", x: 106, y: 82 },
    { sprite: "water_dispenser", x: 126, y: 204, solid: true },
    { sprite: "bin", x: 110, y: 210 },
    { sprite: "big_plant", x: 124, y: 234, solid: true },
  ],

  /**
   * Seats. Each sits a few px above its furniture's anchor so the furniture draws over
   * the lower body - see the note at the top of this file.
   *   desk       is drawn from 92, so the manager stands at 112 and the desk surface
   *              crosses their chest. Its front lip blocks at 114, one step below.
   *   big_sofa   is drawn from 125, so a visitor stands at 142.
   *   small_sofa is drawn from 147, so the second visitor stands at 164.
   */
  seats: [
    { id: "desk", x: 44, y: 112, dir: "down", role: "manager" },
    { id: "sofa", x: 90, y: 142, dir: "down", role: "visitor" },
    { id: "armchair", x: 114, y: 164, dir: "down", role: "visitor" },
  ],

  spawns: [
    { x: 96, y: 204 },
    { x: 66, y: 216 },
    // Index 2: just inside the door, for coming back in from outside.
    { x: 126, y: 70 },
  ],
  joinSpawns: 2,

  exits: [
    { rect: { x: 118, y: WALL, w: 16, h: 10 }, to: "outside", spawn: 0, label: "GO OUTSIDE" },
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
    { id: "desk", rect: { x: 28, y: 108, w: 32, h: 16 }, label: "THE DESK", action: "sit" },
    { id: "sofa", rect: { x: 76, y: 130, w: 28, h: 18 }, label: "SOFA", action: "sit" },
    { id: "cooler", rect: { x: 118, y: 190, w: 20, h: 16 }, label: "WATER COOLER", action: "drink" },
  ],
};
