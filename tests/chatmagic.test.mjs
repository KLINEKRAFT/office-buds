/**
 * The phrase table, and the two ways it can be wrong.
 *
 * It can fail to fire, which is a disappointment. Or it can fire when nobody asked,
 * which is much worse: a review pass found that "leave", "raise", "status" and "coffee"
 * were all loose substring matches, so an ordinary sentence about taking a break turned
 * the whole room out. The rule that came out of it is encoded below - anything
 * disruptive has to be an exact match - and the conversation at the bottom of this file
 * is the regression test for it.
 */
import assert from "node:assert/strict";

import { check, report, suite } from "./harness.mjs";
import { CHAT_MAGIC, matchChatMagic, normalizeSaid } from "../.testbuild/chatMagic.js";
import { EMOTES } from "../.testbuild/core/emotes.js";
import { CHARACTER_IDS } from "../.testbuild/types.js";

const say = (text, who = "michael", zones = []) => matchChatMagic(text, who, zones);

suite("normalising what was typed");

check("case, punctuation and spacing are all ignored", () => {
  assert.equal(normalizeSaid("  OK...  Lets   GO!! "), "ok lets go");
});

check("apostrophes close up rather than splitting the word", () => {
  // "let's" splitting into "let s" made every contraction in the table unreachable by
  // its own spelling, which is how "let's party" managed not to start a party.
  assert.equal(normalizeSaid("let's"), "lets");
  assert.equal(normalizeSaid("it’s friday"), "its friday");
});

suite("matching");

check("a phrase fires on whole words, not substrings", () => {
  assert.ok(say("hi there"), "'hi there' should wave");
  assert.equal(say("this is thin"), null, "'this' must not match 'hi'");
});

check("surrounding words do not stop a loose phrase", () => {
  assert.ok(say("ok everyone party time now"));
});

check("an exact phrase does not fire mid-sentence", () => {
  assert.equal(say("i have to leave in five minutes"), null);
  assert.equal(say("ill raise a ticket for that"), null);
  assert.equal(say("grabbing a coffee, back in ten"), null);
});

check("an exact phrase does fire on its own", () => {
  assert.equal(say("leave")?.effect, "leave");
  assert.equal(say("Coffee!")?.announce, "{name} IS MAKING A ROUND");
});

suite("who may say what, and where");

check("the rite refuses everybody but Colin", () => {
  for (const id of CHARACTER_IDS) {
    const hit = say("let us begin", id, ["leader_stone"]);
    if (id === "colin") assert.ok(hit, "Colin on the stone should begin the rite");
    else assert.equal(hit, null, `${id} must not be able to begin the rite`);
  }
});

check("the rite refuses Colin when he is not on the stone", () => {
  assert.equal(say("let us begin", "colin", []), null);
  assert.equal(say("i summon thee", "colin", ["circle"]), null);
});

check("anyone can offer themselves, anywhere", () => {
  for (const id of CHARACTER_IDS) {
    assert.equal(say("i ascend", id, [])?.effect, "ascend_self");
  }
});

suite("the table is internally consistent");

const EMOTE_NAMES = new Set(EMOTES.map((e) => e.clip));

check("every emote named in the table is a real emote", () => {
  for (const magic of CHAT_MAGIC) {
    if (!magic.emote) continue;
    assert.ok(EMOTE_NAMES.has(magic.emote), `"${magic.phrases[0]}" plays unknown emote ${magic.emote}`);
  }
});

check("every room-wide emote effect names a real emote", () => {
  for (const magic of CHAT_MAGIC) {
    if (!magic.effect?.startsWith("emote:")) continue;
    const clip = magic.effect.slice("emote:".length);
    assert.ok(EMOTE_NAMES.has(clip), `"${magic.phrases[0]}" broadcasts unknown emote ${clip}`);
  }
});

check("every effect is one the game knows how to run", () => {
  // Kept in step with applyEffect by hand; a typo here is otherwise silent, because an
  // unrecognised effect simply does nothing and looks like a phrase that did not match.
  const known = new Set([
    "leave", "summon", "banish", "ascend_self", "ascend_all", "ascend_others",
    "return_all", "normal", "party", "dark", "ritual", "shake", "confetti",
  ]);
  for (const magic of CHAT_MAGIC) {
    if (!magic.effect || magic.effect.startsWith("emote:")) continue;
    assert.ok(known.has(magic.effect), `unknown effect "${magic.effect}"`);
  }
});

check("every phrase is already normalised", () => {
  // A phrase with a capital or an apostrophe in it can never match, because the incoming
  // message is normalised and the phrase is compared against it.
  for (const magic of CHAT_MAGIC) {
    for (const p of magic.phrases) {
      assert.equal(p, normalizeSaid(p), `"${p}" is not in normalised form`);
    }
  }
});

check("no phrase is claimed by two entries", () => {
  const owner = new Map();
  for (const magic of CHAT_MAGIC) {
    for (const p of magic.phrases) {
      const key = `${magic.only?.join(",") ?? ""}|${magic.where ?? ""}|${p}`;
      assert.ok(!owner.has(key), `"${p}" appears twice with the same gating`);
      owner.set(key, magic);
    }
  }
});

check("anything that takes control away from other people is an exact match", () => {
  /*
   * The line is not "does it affect the room" - the lights and the confetti do, and
   * they should stay easy to set off in the middle of a sentence, because that is the
   * joke. The line is whether it takes something away from somebody else:
   *
   *   leave     ends everyone's session
   *   emote:*   puppets everyone's character
   *
   * Both of those on a loose match are how "I have to leave in five" turned the whole
   * office out. A shaking screen for one second is not in that category.
   *
   * The rite is exempt because it is gated harder than exactness: you have to be Colin
   * AND standing on the stone.
   */
  for (const magic of CHAT_MAGIC) {
    if (!magic.effect || magic.where) continue;
    const takesControl = magic.effect === "leave" || magic.effect.startsWith("emote:");
    if (!takesControl) continue;
    assert.ok(
      magic.exact,
      `"${magic.phrases[0]}" fires ${magic.effect} on a loose match and will go off by accident`,
    );
  }
});

suite("a completely ordinary conversation sets nothing off");

const CONVERSATION = [
  "morning, how was your weekend",
  "not bad, went to my sisters",
  "did you see the ticket i raised yesterday",
  "yeah ill circle back to it after this call",
  "im going to leave around five today",
  "no worries, ill deploy the fix before then",
  "is prod ok now",
  "think so, the site is down was a false alarm",
  "someone should raise this at the standup tomorrow",
  "ill grab a coffee first",
  "im dying to get this finished",
];

for (const line of CONVERSATION) {
  check(`"${line}"`, () => {
    const hit = say(line);
    // Waves and the like are welcome mid-conversation; a room-wide effect is not.
    if (hit?.effect) {
      assert.fail(`fired ${hit.effect}`);
    }
  });
}

report();
