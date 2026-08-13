/**
 * The peer-identity decoder, tested without a socket.
 *
 * This exists because of a real bug: the Supabase driver decoded every arriving peer as
 * one of the two characters that existed when it was written, so Alexis, Melanie and
 * Tiffany all appeared as Colin to everyone else while looking correct to themselves.
 * Nothing caught it, because every automated test used the same-browser driver, which
 * had its own copy of the logic and no bug. Both drivers now share one decoder, and this
 * checks it against the real character list.
 */
import assert from "node:assert/strict";
import { CHARACTER_IDS } from "../.testbuild/types.js";
import { decodeIdentity, decodeMove, FALLBACK_CHARACTER, FALLBACK_NAME } from "../.testbuild/net/identity.js";
import { castFor } from "../.testbuild/cast.js";
import { DOOMS, headline, parseDoom, parseRevive, doomEffect } from "../.testbuild/doom.js";

let passed = 0;
const check = (label, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${label}`);
  } catch (e) {
    console.log(`  FAIL ${label}\n       ${e.message}`);
    process.exitCode = 1;
  }
};

console.log("decodeIdentity");

// The regression itself: every character must survive the round trip as itself.
for (const id of CHARACTER_IDS) {
  check(`${id} decodes as ${id}`, () => {
    const got = decodeIdentity("abc", { name: "SOMEONE", character: id });
    assert.equal(got.character, id);
  });
}

check("five characters are known, not two", () => {
  assert.equal(CHARACTER_IDS.length, 5);
});

check("an unknown character falls back rather than being clamped to a real one", () => {
  const got = decodeIdentity("abc", { name: "X", character: "gary" });
  assert.equal(got.character, FALLBACK_CHARACTER);
});

for (const [label, meta] of [
  ["missing meta", undefined],
  ["null meta", null],
  ["empty meta", {}],
  ["numeric character", { character: 7 }],
  ["object character", { character: { id: "colin" } }],
]) {
  check(`${label} falls back safely`, () => {
    const got = decodeIdentity("abc", meta);
    assert.ok(CHARACTER_IDS.includes(got.character), `${got.character} is not a real character`);
  });
}

check("id is passed through untouched", () => {
  assert.equal(decodeIdentity("xyz123", { character: "colin" }).id, "xyz123");
});

check("a missing name becomes the fallback", () => {
  assert.equal(decodeIdentity("a", { character: "colin" }).name, FALLBACK_NAME);
});

check("a blank name becomes the fallback", () => {
  assert.equal(decodeIdentity("a", { name: "   ", character: "colin" }).name, FALLBACK_NAME);
});

check("a long name is truncated to 12", () => {
  assert.equal(decodeIdentity("a", { name: "A".repeat(40), character: "colin" }).name.length, 12);
});

check("a non-string name does not crash", () => {
  assert.equal(decodeIdentity("a", { name: 42, character: "colin" }).name, FALLBACK_NAME);
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}`);


// ---------------------------------------------------------------------------------
// The movement decoder, shared by both transports for the same reason the identity
// decoder is: it used to be written out twice, and that is exactly how a field got
// added to one copy and not the other.
console.log("\ndecodeMove");

check("a full packet survives intact", () => {
  const packet = {
    x: 12, y: 34, dir: "left", moving: true, running: true, emote: "dance",
    room: "grove", carrying: 3, ascended: true, dead: 5,
  };
  assert.deepEqual(decodeMove(packet), packet);
});

check("a peer on an older build is not doing the newest thing", () => {
  // The honest reading of a missing field is "not that", not "undefined".
  const state = decodeMove({ x: 0, y: 0 });
  assert.equal(state.dead, -1);
  assert.equal(state.running, false);
  assert.equal(state.carrying, -1);
  assert.equal(state.ascended, false);
  assert.equal(state.emote, "");
  assert.equal(state.room, "office");
  assert.equal(state.dir, "down");
});

check("nonsense is refused rather than drawn", () => {
  assert.equal(decodeMove(null), null);
  assert.equal(decodeMove({}), null);
  assert.equal(decodeMove({ x: "over there", y: 4 }), null);
  assert.equal(decodeMove({ x: NaN, y: 0 }), null);
});

check("a junk direction lands on a real one", () => {
  assert.equal(decodeMove({ x: 0, y: 0, dir: "sideways" }).dir, "down");
});

// ---------------------------------------------------------------------------------
console.log("\nnames we do not know");

check("an unfamiliar name is not automatically Michael", () => {
  // Reported: "jenni looks like michael". Every unknown name fell to one fallback.
  assert.notEqual(castFor("JENNI").character, FALLBACK_CHARACTER);
});

check("an unfamiliar name gets the same face every time", () => {
  assert.equal(castFor("JENNI").character, castFor("jenni").character);
  assert.equal(castFor("JENNI").character, castFor("Jenni Smith").character);
});

check("two unfamiliar names do not all collapse to one face", () => {
  const seen = new Set(
    ["JENNI", "SAM", "PRIYA", "OMAR", "ROBIN", "DALE", "KIT"].map((n) => castFor(n).character),
  );
  assert.ok(seen.size > 1, `every guest came out as ${[...seen]}`);
});

check("the named cast still get their own faces", () => {
  assert.equal(castFor("colin").character, "colin");
  assert.equal(castFor("MIKE").character, "michael");
  assert.equal(castFor("Tiffany").character, "tiffany");
});

// ---------------------------------------------------------------------------------
console.log("\nways to go");

check("a death round-trips through the effect string", () => {
  for (let i = 0; i < DOOMS.length; i++) {
    assert.deepEqual(parseDoom(doomEffect("abc123", i)), {
      id: "abc123",
      cause: i,
      weapon: "",
    });
  }
});

check("a weapon round-trips too", () => {
  assert.deepEqual(parseDoom(doomEffect("abc", 2, "plant_tall")), {
    id: "abc",
    cause: 2,
    weapon: "plant_tall",
  });
});

check("an id with a colon in it still parses", () => {
  // Which is why the id goes last: it is the only part that could contain one.
  assert.deepEqual(parseDoom(doomEffect("a:b:c", 2)), { id: "a:b:c", cause: 2, weapon: "" });
});

check("a cause off the end of the list is refused", () => {
  assert.equal(parseDoom(`doom:${DOOMS.length}::x`), null);
  assert.equal(parseDoom("doom:-1::x"), null);
  assert.equal(parseDoom("doom:banana::x"), null);
  assert.equal(parseDoom("doom:1::"), null);
  assert.equal(parseDoom("party"), null);
});

check("reviving parses, and is not confused with dying", () => {
  assert.equal(parseRevive("undoom:abc"), "abc");
  assert.equal(parseRevive("doom:abc:1"), null);
  assert.equal(parseDoom("undoom:abc"), null);
});

check("every cause has a headline and a button that fits", () => {
  for (const d of DOOMS) {
    assert.ok(d.label.length > 0, "a cause with no headline");
    assert.ok(d.short.length > 0 && d.short.length <= 9, `"${d.short}" will not fit a button`);
  }
});

check("the headline names the victim", () => {
  assert.match(headline("MICHAEL", 3), /^MICHAEL /);
});

check("what you were holding becomes what you did it with", () => {
  assert.equal(
    headline("MICHAEL", 3, "plant_tall"),
    "MICHAEL WAS BEATEN TO DEATH WITH THE PLANT TALL",
  );
  // Empty hands fall back to the cause on the list.
  assert.equal(headline("MICHAEL", 3, ""), `MICHAEL ${DOOMS[3].label}`);
});

console.log(`\n${passed} passed`);
