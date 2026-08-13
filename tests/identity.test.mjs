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
import { decodeIdentity, FALLBACK_CHARACTER, FALLBACK_NAME } from "../.testbuild/net/identity.js";

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
