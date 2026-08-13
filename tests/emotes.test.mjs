/**
 * Every character can do everything their HUD offers them.
 *
 * This exists because for a while three of the five could do nothing at all. Alexis,
 * Melanie and Tiffany shipped with six locomotion clips each and no emote sheets, so
 * `availableEmotes` filtered their entire list away and they got two HUD buttons while
 * Colin got five. Nothing failed; the feature was simply absent for most of the cast,
 * quietly, in a game about hanging out with your friends.
 *
 * So the assertions here are deliberately about PARITY rather than about any one
 * animation: everybody is offered a useful set, every button that appears resolves to
 * something that will actually play, and every frame it plays is inside that character's
 * own atlas. The last one matters because the synthesised emotes index frames
 * arithmetically - an off-by-one reads somebody else's sprite, or empty space.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { check, report, suite } from "./harness.mjs";
import {
  EMOTES,
  emotesFor,
  frameRect,
  procPose,
  procSeconds,
  resolveEmote,
} from "../.testbuild/core/emotes.js";
import { CHARACTER_IDS } from "../.testbuild/types.js";

const manifest = JSON.parse(readFileSync(new URL("../public/assets/characters.json", import.meta.url)));
const CHARACTERS = manifest.characters;

/** How many emotes anybody must be able to do. Colin has seven; nobody gets fewer. */
const MINIMUM = 6;

suite("the real atlas manifest");

check("every character in the code has art built for it", () => {
  for (const id of CHARACTER_IDS) {
    assert.ok(CHARACTERS[id], `${id} is in CHARACTER_IDS but not in characters.json`);
  }
});

check("every character has the six clips the synthesised emotes are built from", () => {
  const needed = ["idle_down", "idle_side", "idle_up", "walk_down", "walk_side", "walk_up"];
  for (const id of CHARACTER_IDS) {
    for (const clip of needed) {
      assert.ok(CHARACTERS[id].clips[clip], `${id} has no ${clip}`);
    }
  }
});

suite("emote parity");

for (const id of CHARACTER_IDS) {
  const meta = CHARACTERS[id];

  check(`${id} is offered at least ${MINIMUM} emotes`, () => {
    const offered = emotesFor(meta);
    assert.ok(
      offered.length >= MINIMUM,
      `${id} only gets ${offered.length}: ${offered.map((e) => e.clip).join(", ")}`,
    );
  });

  check(`${id}'s offered emotes all resolve to something playable`, () => {
    for (const e of emotesFor(meta)) {
      const r = resolveEmote(meta, e.clip);
      assert.ok(r, `${id} is offered ${e.clip} but it resolves to nothing`);
      if (r.kind === "art") {
        assert.ok(meta.clips[r.name], `${id} resolves ${e.clip} to missing art ${r.name}`);
      }
    }
  });

  check(`${id} never draws a frame outside its own atlas`, () => {
    for (const e of emotesFor(meta)) {
      const r = resolveEmote(meta, e.clip);
      if (r.kind !== "proc") continue;
      // Walk the whole clip, and past its end - a held emote like the faint keeps being
      // asked for poses long after its nominal duration.
      const span = Number.isFinite(procSeconds(r.name)) ? procSeconds(r.name) : 3;
      for (let t = 0; t <= span + 1; t += 1 / 60) {
        for (const dir of ["up", "down", "left", "right"]) {
          const pose = procPose(r.name, t, meta, dir);
          assert.ok(pose, `${id}/${e.clip} produced no pose at t=${t.toFixed(2)}`);
          assert.ok(
            Number.isInteger(pose.frame) && pose.frame >= 0 && pose.frame < meta.total,
            `${id}/${e.clip} frame ${pose.frame} is outside 0..${meta.total - 1}`,
          );
          const { sx, sy } = frameRect(meta, pose.frame);
          assert.ok(sx >= 0 && sy >= 0, `${id}/${e.clip} negative source rect`);
          for (const [k, v] of Object.entries(pose)) {
            assert.ok(Number.isFinite(v) || typeof v === "boolean", `${id}/${e.clip} ${k} is ${v}`);
          }
        }
      }
    }
  });
}

suite("hand-drawn art wins over the stand-in");

check("Colin's jump is his own sheet, not the synthesised hop", () => {
  const r = resolveEmote(CHARACTERS.colin, "jump");
  assert.equal(r.kind, "art");
  assert.equal(r.name, "jump");
});

check("Melanie's jump falls back to the synthesised hop", () => {
  const r = resolveEmote(CHARACTERS.melanie, "jump");
  assert.equal(r.kind, "proc");
  assert.equal(r.name, "hop");
});

check("Colin and Michael wave with the real wave", () => {
  for (const id of ["colin", "michael"]) {
    assert.equal(resolveEmote(CHARACTERS[id], "wave").kind, "art");
  }
});

check("the three without a wave sheet still greet", () => {
  for (const id of ["alexis", "melanie", "tiffany"]) {
    const r = resolveEmote(CHARACTERS[id], "wave");
    assert.equal(r.kind, "proc", `${id} cannot wave at all`);
    assert.equal(r.name, "greet");
  }
});

check("WAVE and JUMP never play the identical animation", () => {
  // If they did, one of the two buttons would look broken.
  for (const id of CHARACTER_IDS) {
    const wave = resolveEmote(CHARACTERS[id], "wave");
    const jump = resolveEmote(CHARACTERS[id], "jump");
    assert.notDeepEqual(wave, jump, `${id}'s WAVE and JUMP are the same thing`);
  }
});

check("the laptop is Colin's alone, and is not faked", () => {
  assert.equal(resolveEmote(CHARACTERS.colin, "laptop").kind, "art");
  for (const id of ["alexis", "melanie", "tiffany", "michael"]) {
    assert.equal(resolveEmote(CHARACTERS[id], "laptop"), null, `${id} should not be offered WORK`);
  }
});

suite("the emote table itself");

check("no two entries share a clip name", () => {
  const seen = new Set();
  for (const e of EMOTES) {
    assert.ok(!seen.has(e.clip), `${e.clip} is listed twice`);
    seen.add(e.clip);
  }
});

check("every entry can be played by somebody", () => {
  for (const e of EMOTES) {
    const anyone = CHARACTER_IDS.some((id) => resolveEmote(CHARACTERS[id], e.clip));
    assert.ok(anyone, `${e.clip} is offered to nobody and is dead weight`);
  }
});

check("a clip nobody has resolves to nothing rather than throwing", () => {
  assert.equal(resolveEmote(CHARACTERS.tiffany, "moonwalk"), null);
});

check("the faint holds until you move", () => {
  assert.equal(procSeconds("faint"), Infinity);
});

report();
