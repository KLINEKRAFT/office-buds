import { TILE } from "../config";
import type { PropDef, RoomDef } from "./types";

/**
 * The one room in version 1: 448x392 world px, with a 40px wall band along the top.
 *
 * Reading left to right: a strip of cabinets against the left wall, a six-desk cubicle
 * farm, a vertical aisle, a middle column holding the copier bay, a supply nook and the
 * conference table, another aisle, then the boss's corner, break area and lounge down
 * the right. A wide corridor runs along the top wall past the door, and another across
 * the bottom, so there are always at least two ways around any cluster.
 *
 * Clusters sit ~30px apart, a little over two body widths - loose enough never to feel
 * like a maze, tight enough that two people wandering keep running into each other,
 * which is the entire point of the room. The perimeter is lined with furniture so the
 * floor reads as an enclosed office rather than props adrift on carpet.
 *
 * Props are placed by bottom-centre. Anything resting on a surface gets a `bias` so it
 * depth-sorts after the furniture it sits on.
 */

const WALL = 40;

/** A desk, its cubicle wall and its chair, as one repeated unit. */
function cubicle(
  x: number,
  y: number,
  desk: "desk" | "desk_2",
  chair: "chair" | "chair_2",
  flip = false,
): PropDef[] {
  return [
    { sprite: "partition", x, y: y - 30, solid: true },
    { sprite: desk, x, y, solid: true, flip },
    { sprite: chair, x, y: y + 12 },
  ];
}

export const office: RoomDef = {
  id: "office",
  name: "THE OFFICE",
  widthTiles: 28,
  heightTiles: 22,
  wallHeight: WALL,

  // Warm carpet through the break area and lounge, so the right-hand side of the floor
  // reads as somewhere you hang out rather than somewhere you work.
  floorZones: [
    // Break area + lounge, down the right.
    { tx: 20, ty: 9, tw: 8, th: 13, tiles: ["floor_warm_a", "floor_warm_b"] },
    // A separate patch under the conference table, with a strip of cool carpet left
    // between them so the two zones read as two rooms rather than one L-shape.
    { tx: 12, ty: 13, tw: 7, th: 6, tiles: ["floor_warm_a", "floor_warm_b"] },
  ],

  props: [
    // ---- wall band ----------------------------------------------------------
    { sprite: "window", x: 64, y: 32, layer: "wall" },
    { sprite: "window", x: 132, y: 32, layer: "wall" },
    { sprite: "wall_graph", x: 178, y: 32, layer: "wall" },
    { sprite: "wall_note", x: 198, y: 32, layer: "wall" },
    { sprite: "wall_note_2", x: 218, y: 30, layer: "wall" },
    { sprite: "board", x: 248, y: 30, layer: "wall" },
    { sprite: "door", x: 300, y: 40, layer: "wall" },
    { sprite: "wall_clock", x: 338, y: 30, layer: "wall" },
    { sprite: "wall_shelf", x: 368, y: 26, layer: "wall" },
    { sprite: "mirror", x: 396, y: 30, layer: "wall" },
    { sprite: "window", x: 428, y: 32, layer: "wall" },

    // ---- left wall: storage strip -------------------------------------------
    { sprite: "big_plant", x: 18, y: 92, solid: true },
    { sprite: "filing_cabinet_tall", x: 16, y: 152, solid: true },
    { sprite: "wide_filing_cabinet", x: 20, y: 212, solid: true },
    { sprite: "bookshelf", x: 16, y: 264, solid: true },
    { sprite: "bin", x: 16, y: 300 },
    { sprite: "big_plant", x: 18, y: 352, solid: true },

    // ---- cubicle farm --------------------------------------------------------
    ...cubicle(70, 142, "desk", "chair"),
    ...cubicle(134, 142, "desk_2", "chair_2"),
    ...cubicle(70, 240, "desk_2", "chair_2", true),
    ...cubicle(134, 240, "desk", "chair"),
    ...cubicle(70, 338, "desk", "chair_2"),
    ...cubicle(134, 338, "desk_2", "chair"),

    // ---- middle: copier bay ---------------------------------------------------
    { sprite: "printer_furniture", x: 196, y: 130, solid: true },
    { sprite: "papers", x: 196, y: 118, bias: 20 },
    { sprite: "big_office_printer", x: 232, y: 132, solid: true },
    { sprite: "filing_cabinet_open", x: 264, y: 130, solid: true },
    { sprite: "bookshelf", x: 288, y: 126, solid: true },

    // ---- middle: supply nook ---------------------------------------------------
    { sprite: "small_table", x: 196, y: 192, solid: true },
    { sprite: "folders", x: 196, y: 186, bias: 20 },
    { sprite: "filing_cabinet_small", x: 220, y: 192, solid: true },
    { sprite: "small_plant", x: 246, y: 190 },
    { sprite: "bin", x: 272, y: 194 },

    // ---- middle: conference table ------------------------------------------------
    { sprite: "chair", x: 216, y: 264 },
    { sprite: "chair", x: 264, y: 264, flip: true },
    { sprite: "big_round_table", x: 240, y: 290, solid: true },
    { sprite: "chair_2", x: 216, y: 306 },
    { sprite: "chair_2", x: 264, y: 306, flip: true },

    // ---- right: boss's corner --------------------------------------------------
    { sprite: "tall_bookshelf", x: 340, y: 140, solid: true },
    { sprite: "boss_chair", x: 372, y: 124 },
    { sprite: "boss_desk", x: 372, y: 140, solid: true },
    { sprite: "books", x: 364, y: 132, bias: 20 },
    { sprite: "big_filing_cabinet", x: 404, y: 138, solid: true },
    { sprite: "small_plant", x: 428, y: 136 },

    // ---- right: break area ------------------------------------------------------
    { sprite: "small_table", x: 346, y: 206, solid: true },
    { sprite: "coffee_machine", x: 346, y: 198, bias: 20 },
    { sprite: "water_dispenser", x: 372, y: 206, solid: true },
    { sprite: "vending_machine", x: 402, y: 208, solid: true },
    { sprite: "bin", x: 428, y: 202 },

    // ---- right: lounge -------------------------------------------------------------
    { sprite: "big_plant", x: 432, y: 254, solid: true },
    { sprite: "big_sofa", x: 390, y: 285, solid: true },
    { sprite: "small_sofa", x: 348, y: 296, solid: true },
    { sprite: "big_sofa_2", x: 430, y: 296, solid: true, flip: true },
    { sprite: "small_table", x: 390, y: 302, solid: true },

    // ---- bottom edge ----------------------------------------------------------------
    { sprite: "big_plant", x: 348, y: 374, solid: true },
    { sprite: "filing_cabinet_small", x: 400, y: 372, solid: true },
    { sprite: "small_plant", x: 428, y: 374 },
    { sprite: "bin", x: 292, y: 366 },
    { sprite: "small_plant", x: 176, y: 372 },
  ],

  // Keep players out of the doorway recess itself.
  blockers: [{ x: 292, y: WALL - 3, w: 18, h: 5 }],

  // Both spawns are in the top corridor just inside the door, so arriving feels like
  // walking into the office - and so two friends land within sight of each other.
  spawns: [
    { x: 286, y: 64 },
    { x: 318, y: 72 },
  ],

  // Reserved for the small interactions in a later pass - nothing reads these yet.
  zones: [
    { id: "coffee", rect: { x: 334, y: 206, w: 26, h: 22 }, label: "COFFEE", action: "drink" },
    { id: "cooler", rect: { x: 362, y: 206, w: 22, h: 22 }, label: "WATER COOLER", action: "drink" },
    { id: "vending", rect: { x: 390, y: 208, w: 24, h: 22 }, label: "VENDING MACHINE", action: "buy" },
    { id: "copier", rect: { x: 214, y: 132, w: 38, h: 22 }, label: "COPIER", action: "copy" },
    { id: "table", rect: { x: 210, y: 264, w: 62, h: 46 }, label: "CONFERENCE TABLE", action: "sit" },
    { id: "lounge", rect: { x: 370, y: 285, w: 42, h: 20 }, label: "SOFA", action: "sit" },
  ],
};

export const OFFICE_WIDTH = 28 * TILE;
