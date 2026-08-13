/**
 * The rooms, checked against the atlas they are drawn from.
 *
 * Every mistake caught here is one that only shows up as something looking wrong on a
 * phone, which is the worst kind to have: a typo'd sprite name throws at room-build time
 * and takes the whole game with it, a spawn inside a doorway bounces you straight back
 * out (that one shipped), and a prop laid out inside a wall's art band silently
 * disappears behind it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { check, report, suite } from "./harness.mjs";
import { office } from "../.testbuild/world/office.js";
import { grove } from "../.testbuild/world/grove.js";
import { roomColliders } from "../.testbuild/world/build.js";

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../public/assets/${name}`, import.meta.url)));

const SPRITES = {
  office: load("props.json").sprites,
  village: load("village.json").sprites,
};
const ATLASES = {
  office: new Set(Object.keys(SPRITES.office)),
  village: new Set(Object.keys(SPRITES.village)),
};

const ROOMS = [office, grove];
const TILE = 16;

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** The feet-level box, matching bodyRect in the collision code. */
const body = (x, y) => ({ x: x - 6, y: y - 7, w: 12, h: 7 });

for (const room of ROOMS) {
  const sprites = ATLASES[room.atlas];
  const width = room.widthTiles * TILE;
  const height = room.wallHeight + room.heightTiles * TILE;
  // Props may hang off an edge on purpose - the oaks that close the grove in are placed
  // past the bottom so the wood carries on past the frame - so this is a typo check, not
  // a containment rule. Wall-mounted props live in the band above the floor.
  const OVERHANG = 48;
  const inside = (x, y, layer) =>
    x >= -OVERHANG &&
    x <= width + OVERHANG &&
    y >= (layer === "wall" ? 0 : -OVERHANG) &&
    y <= height + OVERHANG;

  suite(`${room.id}`);

  check("every sprite it names exists in its atlas", () => {
    for (const p of room.props) {
      // A door is four numbered frames under one base name.
      const names = p.door ? [0, 1, 2].map((i) => `${p.sprite}_${i}`) : [p.sprite];
      for (const n of names) {
        assert.ok(sprites.has(n), `prop "${n}" is not in the ${room.atlas} atlas`);
      }
    }
    for (const t of room.groundTiles) {
      assert.ok(sprites.has(t), `ground tile "${t}" is missing`);
    }
    for (const zone of room.floorZones ?? []) {
      for (const t of zone.tiles ?? []) assert.ok(sprites.has(t), `floor tile "${t}" is missing`);
      if (!zone.nine) continue;
      for (const v of ["t", "m", "b"]) {
        for (const h of ["l", "c", "r"]) {
          assert.ok(sprites.has(`${zone.nine}_${v}${h}`), `nine-slice ${zone.nine}_${v}${h} missing`);
        }
      }
    }
    if (room.wallTile) assert.ok(sprites.has(room.wallTile), `wall tile "${room.wallTile}" missing`);
    for (const run of room.walls ?? []) {
      const t = run.tile ?? room.wallTile;
      assert.ok(sprites.has(t), `wall run tile "${t}" missing`);
    }
  });

  check("every prop stands inside the room", () => {
    for (const p of room.props) {
      assert.ok(inside(p.x, p.y, p.layer), `${p.sprite} at (${p.x}, ${p.y}) is nowhere near the room`);
    }
  });

  check("every spawn is inside the room", () => {
    for (const [i, s] of room.spawns.entries()) {
      assert.ok(
        s.x >= 0 && s.x <= width && s.y >= room.wallHeight && s.y <= height,
        `spawn ${i} at (${s.x}, ${s.y}) is outside the room`,
      );
    }
  });

  check("no join spawn sits inside an exit", () => {
    // The bug this is for: arriving in the grove on a spawn that was inside the doorway
    // back, so the exit cooldown expired while still standing in it and you were walked
    // indoors again without touching anything.
    const joinable = room.spawns.slice(0, room.joinSpawns ?? room.spawns.length);
    for (const [i, s] of joinable.entries()) {
      for (const exit of room.exits ?? []) {
        assert.ok(!overlaps(body(s.x, s.y), exit.rect), `join spawn ${i} is inside the ${exit.to} exit`);
      }
    }
  });

  check("no spawn or seat starts inside solid furniture", () => {
    const solids = room.props
      .filter((p) => p.solid && !p.takeable)
      .map((p) => p.collider)
      .filter(Boolean);
    for (const [i, s] of room.spawns.entries()) {
      for (const c of solids) {
        assert.ok(!overlaps(body(s.x, s.y), c), `spawn ${i} is inside a collider`);
      }
    }
    for (const seat of room.seats ?? []) {
      for (const c of solids) {
        assert.ok(!overlaps(body(seat.x, seat.y), c), `seat "${seat.id}" is inside a collider`);
      }
    }
  });

  check("every exit and say-trigger points at a room that exists", () => {
    const ids = new Set(ROOMS.map((r) => r.id));
    for (const exit of room.exits ?? []) {
      assert.ok(ids.has(exit.to), `exit goes to unknown room "${exit.to}"`);
      const target = ROOMS.find((r) => r.id === exit.to);
      assert.ok(target.spawns[exit.spawn ?? 0], `${exit.to} has no spawn ${exit.spawn}`);
    }
    for (const t of room.sayTriggers ?? []) {
      assert.ok(ids.has(t.to), `say trigger goes to unknown room "${t.to}"`);
      const target = ROOMS.find((r) => r.id === t.to);
      assert.ok(target.spawns[t.spawn ?? 0], `${t.to} has no spawn ${t.spawn}`);
    }
  });
}

suite("office walls and doorways");

const wallBase = (ty) => office.wallHeight + (ty + 1) * TILE;
/** The office's real collision, auto footprints and all. */
const OFFICE_COLLIDERS = roomColliders(office, (name) => SPRITES.office[name]);
const row = (ty) => office.wallHeight + ty * TILE;

/** Every wall tile, expanded from the runs, with the gaps marked. */
function wallTiles() {
  const out = [];
  for (const run of office.walls ?? []) {
    const open = new Set();
    for (const gap of run.gaps ?? []) {
      for (let i = 0; i < gap.len; i++) open.add(gap.at + i);
    }
    for (let i = 0; i < run.len; i++) {
      const tx = run.dir === "h" ? run.tx + i : run.tx;
      const ty = run.dir === "v" ? run.ty + i : run.ty;
      out.push({ tx, ty, gap: open.has(i), run, at: i });
    }
  }
  return out;
}

check("every door stands in a doorway", () => {
  // A door on a solid wall tile reads as a door you cannot open, and a door floating in
  // open floor reads as a bug. Both are silent; this is not.
  const gaps = wallTiles().filter((t) => t.gap);
  for (const p of office.props) {
    if (!p.door) continue;
    // Two exceptions, both deliberate. The lift doors are on the sealed face of the
    // core, which is the point of them; and a door anchored on the building's own outer
    // wall - the bathrooms - is wall furniture rather than a way between two rooms.
    if (p.sprite === "door_cold") continue;
    if (p.y === office.wallHeight) continue;
    const inGap = gaps.some(
      (t) => Math.abs(p.x - (t.tx * TILE + TILE / 2)) < TILE && p.y === wallBase(t.ty),
    );
    assert.ok(inGap, `${p.sprite} at (${p.x}, ${p.y}) is not standing in a doorway`);
  }
});

check("no doorway runs off the end of its wall", () => {
  for (const run of office.walls ?? []) {
    for (const gap of run.gaps ?? []) {
      assert.ok(gap.at >= 0 && gap.at + gap.len <= run.len, `gap ${gap.at}+${gap.len} is off the wall`);
    }
  }
});

check("nothing tall is laid out inside a wall's art band", () => {
  /*
   * A wall is 32px of art standing on a 16px tile, so it covers the tile behind it too,
   * and it sorts AFTER anything with a smaller y. A prop whose anchor lands in that band,
   * in that column, is drawn and then painted over - it simply is not there, with nothing
   * to say so. Doors are exempt: they are meant to be in the wall.
   */
  for (const t of wallTiles()) {
    if (t.gap) continue;
    const base = wallBase(t.ty);
    const x0 = t.tx * TILE - 8;
    const x1 = t.tx * TILE + TILE + 8;
    for (const p of office.props) {
      if (p.door || p.layer === "wall" || p.layer === "ground") continue;
      const behind = p.y > base - 32 && p.y < base && p.x > x0 && p.x < x1;
      assert.ok(
        !behind,
        `${p.sprite} at (${p.x}, ${p.y}) is inside the wall band at tile ${t.tx},${t.ty}`,
      );
    }
  }
});

check("nothing stands in a doorway", () => {
  /*
   * A desk pushed against a doorway does not look wrong in the data and does not fail
   * anything - it just quietly makes a room unreachable, and you find out by walking the
   * whole floor. So: every gap in every wall, plus a tile of approach on each side, has
   * to be clear of solid furniture and of anything takeable (a PICK UP prompt fighting a
   * door is its own small misery). Doors themselves are exempt; they live there.
   */
  const APPROACH = 16;
  for (const run of office.walls ?? []) {
    for (const gap of run.gaps ?? []) {
      const horizontal = run.dir === "h";
      const x0 = horizontal ? (run.tx + gap.at) * TILE : run.tx * TILE;
      const y0 = horizontal ? row(run.ty) : row(run.ty + gap.at);
      const opening = horizontal
        ? { x: x0, y: y0 - APPROACH, w: gap.len * TILE, h: TILE + APPROACH * 2 }
        : { x: x0 - APPROACH, y: y0, w: TILE + APPROACH * 2, h: gap.len * TILE };

      // Against the colliders the GAME uses, not against `p.collider` - most props do
      // not declare one and get an automatic footprint instead, and reading the field
      // silently skipped every one of them. A printer blocking a doorway got through
      // exactly that hole.
      for (const c of OFFICE_COLLIDERS) {
        if (overlaps(c, opening)) {
          assert.fail(
            `something at ${JSON.stringify(c)} blocks the doorway at ` +
              `${run.dir} ${run.tx},${run.ty}+${gap.at}`,
          );
        }
      }
      for (const p of office.props) {
        // Takeables never block, but a PICK UP prompt fighting a door is its own misery.
        if (p.takeable && overlaps(body(p.x, p.y), opening)) {
          assert.fail(`${p.sprite} sits in the doorway at ${run.dir} ${run.tx},${run.ty}+${gap.at}`);
        }
      }
    }
  }
});

check("nothing stands in front of the lift", () => {
  for (const exit of office.exits ?? []) {
    const approach = {
      // Downward from the exit only: you walk UP to a lift, and the wall its doors are
      // set into is necessarily right behind it.
      x: exit.rect.x - 8,
      y: exit.rect.y,
      w: exit.rect.w + 16,
      h: exit.rect.h + 26,
    };
    for (const c of OFFICE_COLLIDERS) {
      assert.ok(!overlaps(c, approach), `something at ${JSON.stringify(c)} blocks the lift`);
    }
  }
});

check("every room has a way in", () => {
  // A zone with no doorway on its boundary is a room you can see and never enter.
  const gaps = [];
  for (const run of office.walls ?? []) {
    for (const gap of run.gaps ?? []) {
      const horizontal = run.dir === "h";
      gaps.push(
        horizontal
          ? { x: (run.tx + gap.at) * TILE, y: row(run.ty), w: gap.len * TILE, h: TILE }
          : { x: run.tx * TILE, y: row(run.ty + gap.at), w: TILE, h: gap.len * TILE },
      );
    }
  }
  for (const zone of office.zones ?? []) {
    if (zone.id === "lift" || zone.id === "hallway") continue;
    const grown = { x: zone.rect.x - TILE, y: zone.rect.y - TILE, w: zone.rect.w + TILE * 2, h: zone.rect.h + TILE * 2 };
    assert.ok(gaps.some((g) => overlaps(g, grown)), `"${zone.label}" has no doorway onto it`);
  }
});

check("the seats put people where the furniture can cover their legs", () => {
  // A seat works by sorting BEFORE the furniture in front of it. If the seat's y is not
  // smaller than the desk's, the character is drawn on top of the desk instead of behind.
  for (const seat of office.seats ?? []) {
    const front = office.props.find(
      (p) => p.solid && Math.abs(p.x - seat.x) < 20 && p.y > seat.y && p.y - seat.y < 12,
    );
    assert.ok(front, `seat "${seat.id}" has no furniture in front of it to sit behind`);
  }
});

suite("can you actually get anywhere");

/**
 * Flood fill a room from where you arrive in it, using exactly the collision the game
 * uses, and see what you can reach.
 *
 * This is the test for "I am trying to move my guy around and he is stuck". Eyeballing a
 * floor plan tells you it looks right; it cannot tell you that a desk 4px too far left
 * has sealed the print room off, or that the spawn itself is inside a wall. A flood fill
 * can, and it checks all of it at once.
 */
function reachable(room, start) {
  const colliders = roomColliders(room, (name) => SPRITES[room.atlas][name]);
  const width = room.widthTiles * TILE;
  const height = room.wallHeight + room.heightTiles * TILE;
  const STEP = 4; // finer than a character is wide, so it cannot squeeze through a wall
  const blocked = (x, y) => {
    if (x < 6 || x > width - 6 || y < room.wallHeight + 1 || y > height - 2) return true;
    const b = body(x, y);
    return colliders.some((c) => overlaps(b, c));
  };
  const key = (x, y) => `${x},${y}`;
  const snap = (v) => Math.round(v / STEP) * STEP;
  const from = { x: snap(start.x), y: snap(start.y) };
  const seen = new Set([key(from.x, from.y)]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const nx = at.x + dx;
      const ny = at.y + dy;
      if (seen.has(key(nx, ny)) || blocked(nx, ny)) continue;
      seen.add(key(nx, ny));
      queue.push({ x: nx, y: ny });
    }
  }
  return { seen, blocked, snap, STEP };
}

for (const room of ROOMS) {
  const spawn = room.spawns[0];

  check(`${room.id}: you can move at all from where you arrive`, () => {
    const { seen } = reachable(room, spawn);
    assert.ok(seen.size > 20, `only ${seen.size} spots reachable - you are stuck on arrival`);
  });

  check(`${room.id}: every arrival point and seat is somewhere you can stand`, () => {
    const { blocked } = reachable(room, spawn);
    for (const [i, s] of room.spawns.entries()) {
      assert.ok(!blocked(s.x, s.y), `spawn ${i} at (${s.x}, ${s.y}) is inside something`);
    }
    for (const seat of room.seats ?? []) {
      assert.ok(!blocked(seat.x, seat.y), `seat "${seat.id}" is inside something`);
    }
  });
}

check("every room in the office can be walked to from the lift", () => {
  const { seen, snap, STEP } = reachable(office, office.spawns[0]);
  for (const zone of office.zones ?? []) {
    // Sample the zone rather than trusting its centre, which can land on a desk.
    let found = false;
    for (let y = zone.rect.y + 8; y < zone.rect.y + zone.rect.h - 4 && !found; y += STEP) {
      for (let x = zone.rect.x + 8; x < zone.rect.x + zone.rect.w - 4; x += STEP) {
        if (seen.has(`${snap(x)},${snap(y)}`)) {
          found = true;
          break;
        }
      }
    }
    assert.ok(found, `"${zone.label}" cannot be reached from the lift`);
  }
});

check("the seat is reachable, not just standable", () => {
  const { seen, snap } = reachable(office, office.spawns[0]);
  for (const seat of office.seats ?? []) {
    assert.ok(
      seen.has(`${snap(seat.x)},${snap(seat.y)}`),
      `seat "${seat.id}" cannot be walked to`,
    );
  }
});

report();
