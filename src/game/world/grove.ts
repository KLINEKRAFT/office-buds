import type { RoomDef } from "./types";

/**
 * The grove. What used to be a whole village is now one clearing, because nobody was
 * exploring it - they were standing in it talking, and 480x384 of map meant most of that
 * happened off each other's screens.
 *
 * 176x240 world px, sized against a portrait phone the same way the office is: the whole
 * clearing is on screen at once, so a ceremony has an audience.
 *
 * Laid out around the circle. Oaks close the clearing in on every side, the chalk ring
 * sits a little below centre, the altar stone and the orb stand at its head with a
 * brazier either side, and the cottage - still, inexplicably, the way back to the office
 * - is up at the top where you came from.
 *
 * The leader's stone is the spot at the head of the circle. Standing on it is what makes
 * the ceremony words work; see `where` in src/game/chatMagic.ts.
 */

const W = 11; // tiles across -> 176px
const H = 15; // tiles deep   -> 240px

export const grove: RoomDef = {
  id: "grove",
  name: "THE GROVE",
  atlas: "village",
  widthTiles: W,
  heightTiles: H,
  wallHeight: 0,

  groundTiles: [
    "grass_0", "grass_1", "grass_2", "grass_3", "grass_4", "grass_5", "grass_6", "grass_7",
    "grass_8", "grass_9", "grass_10", "grass_11", "grass_12", "grass_13", "grass_14", "grass_15",
  ],

  props: [
    // ---- the chalk ring ---------------------------------------------------------------
    // Ground layer: everyone walks over it, and it never sorts in front of anybody
    // standing inside it.
    { sprite: "ritual_circle", x: 88, y: 200, layer: "ground" },

    // ---- the head of the circle -------------------------------------------------------
    { sprite: "boulder", x: 88, y: 108, solid: true },
    { sprite: "crystal_orb", x: 88, y: 90, bias: 20 },
    { sprite: "lamp_post", x: 34, y: 140 },
    { sprite: "lamp_post", x: 142, y: 140 },

    // ---- the way back -------------------------------------------------------------------
    { sprite: "cottage", x: 84, y: 72, solid: true },
    { sprite: "barrel", x: 140, y: 78, takeable: true },

    // ---- the wood closing it in ----------------------------------------------------------
    { sprite: "oak_tree", x: 10, y: 74, solid: true },
    { sprite: "oak_tree", x: 166, y: 70, solid: true },
    { sprite: "oak_tree", x: 6, y: 148, solid: true },
    { sprite: "oak_tree", x: 172, y: 152, solid: true },
    { sprite: "oak_tree", x: 20, y: 240, solid: true },
    { sprite: "oak_tree", x: 158, y: 244, solid: true },
    { sprite: "bush", x: 34, y: 208 },
    { sprite: "bush", x: 148, y: 212 },

    // ---- offerings, and things to pick up -------------------------------------------------
    { sprite: "mushroom", x: 26, y: 160, takeable: true },
    { sprite: "mushroom", x: 152, y: 164, takeable: true },
    { sprite: "sword", x: 42, y: 232, takeable: true },
    { sprite: "staff", x: 132, y: 234, takeable: true },
    { sprite: "chest_closed", x: 22, y: 212, takeable: true },
    { sprite: "gold_pile", x: 158, y: 222, takeable: true },
  ],

  /**
   * Where people stand. The leader takes the stone at the head of the circle facing the
   * others; everyone else stands in the ring facing up towards the altar, which is why
   * the ceremony reads as a ceremony rather than as five people loitering.
   */
  seats: [
    { id: "leader_stone", x: 88, y: 140, dir: "down", kind: "lead" },
    { id: "circle_left", x: 50, y: 180, dir: "up", kind: "guest" },
    { id: "circle_right", x: 126, y: 180, dir: "up", kind: "guest" },
    { id: "circle_front", x: 88, y: 198, dir: "up", kind: "guest" },
  ],

  spawns: [
    // Index 0: arriving from the office. Deliberately clear of the exit rect below the
    // cottage door - landing inside it meant arriving, waiting out the exit cooldown and
    // then being walked straight back indoors without touching anything.
    { x: 84, y: 104 },
    { x: 58, y: 112 },
    { x: 114, y: 112 },
  ],
  joinSpawns: 3,

  exits: [{ rect: { x: 68, y: 74, w: 32, h: 10 }, to: "office", spawn: 2, label: "GO INSIDE" }],

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

  // The middle of the ring, in front of the leader and between the two who flank it.
  // It sat on the leader's own square at first and was completely hidden behind him,
  // which rather wasted the moment.
  summonAt: { x: 88, y: 176 },

  zones: [
    // The gate on the ceremony words. Generous enough that you do not have to be on an
    // exact pixel, tight enough that you cannot run it from the treeline.
    { id: "leader_stone", rect: { x: 68, y: 126, w: 40, h: 26 }, label: "THE STONE", action: "lead" },
    { id: "circle", rect: { x: 36, y: 152, w: 104, h: 60 }, label: "THE CIRCLE", action: "stand" },
  ],
};
