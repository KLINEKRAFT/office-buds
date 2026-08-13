import type { CharacterId } from "./types";

/**
 * Things that happen when you say the magic words.
 *
 * Rooms already own the phrases that move everyone somewhere else (see `sayTriggers` in
 * the room data). This is the other kind: phrases that do something wherever you are -
 * play an animation, set the room off, drop a banner across the screen.
 *
 * Matching is deliberately loose. You are typing on a phone to a friend, not entering a
 * command: punctuation, case and surrounding words are all ignored, so "ok lets GO!!" and
 * "go" both land. Add a line here and it works for everyone the moment it deploys.
 */

export interface ChatMagic {
  /** Substrings to look for, already lower-case and stripped of punctuation. */
  phrases: string[];
  /** Clip to play on the speaker, if their character has the art for it. */
  emote?: string;
  /** Banner shown to everyone in the room. "{name}" becomes the speaker's name. */
  announce?: string;
  /** Room-wide effect broadcast to everyone: a mood, a burst, or "leave". */
  effect?: string;
  /**
   * Require the whole message to be the phrase, not just to contain it. Reserved for the
   * disruptive ones: "leave" is an ordinary English word, and "I have to leave in five"
   * should not turn the room out.
   */
  exact?: boolean;
  /** Only fires for these characters. Omit for everyone. */
  only?: CharacterId[];
  /**
   * Only fires while standing in this zone of the current room. What turns a phrase into
   * a rite: the words alone are not enough, you have to be on the stone.
   */
  where?: string;
}

export const CHAT_MAGIC: ChatMagic[] = [
  /*
   * ---- the grove ------------------------------------------------------------------
   *
   * The rite. Every one of these is gated three ways: only Colin, only in the grove
   * (nothing else in the game has a `leader_stone` zone), and only while actually
   * standing on the stone. Words alone do nothing, which is the entire point of it being
   * a ceremony rather than a command.
   *
   * On the naming: this is a cartoon in a pixel wood, so the register here is ascension
   * and being taken rather than anything more literal. It reads better and it is one
   * edit to change - the words are just strings in this table.
   */
  {
    phrases: ["let us begin", "the rite begins", "we begin", "begin the rite"],
    only: ["colin"],
    where: "leader_stone",
    effect: "ritual",
    announce: "THE RITE BEGINS",
  },
  {
    phrases: ["i summon thee", "come forth", "rise from the stone", "answer me"],
    only: ["colin"],
    where: "leader_stone",
    effect: "summon",
    announce: "SOMETHING ANSWERS {name}",
  },
  {
    phrases: ["take them", "they are yours", "claim them"],
    only: ["colin"],
    where: "leader_stone",
    effect: "ascend_others",
    announce: "{name} GIVES THEM UP",
  },
  {
    phrases: ["we ascend", "we go together", "all of us"],
    only: ["colin"],
    where: "leader_stone",
    effect: "ascend_all",
    announce: "THEY ALL ASCEND",
  },
  {
    phrases: ["rise", "come back", "i return you", "enough"],
    only: ["colin"],
    where: "leader_stone",
    effect: "return_all",
    announce: "{name} CALLS THEM BACK",
  },
  {
    phrases: ["be gone", "begone", "banish"],
    only: ["colin"],
    where: "leader_stone",
    effect: "banish",
    announce: "IT SINKS BACK INTO THE STONE",
  },
  // Anyone can offer themselves. No stone required - that is rather the point.
  {
    phrases: ["i ascend", "take me", "i give myself"],
    effect: "ascend_self",
    announce: "{name} IS TAKEN",
  },

  // ---- the lights ----------------------------------------------------------------
  {
    phrases: ["party time", "lets party", "party mode", "disco"],
    effect: "party",
    emote: "jump",
    announce: "{name} STARTED A PARTY",
  },
  {
    phrases: ["lights out", "lights off", "kill the lights"],
    effect: "dark",
    announce: "{name} HIT THE LIGHTS",
  },
  {
    phrases: ["party over", "lights on", "back to work everyone", "thats enough"],
    effect: "normal",
    announce: "{name} TURNED THE LIGHTS BACK ON",
  },
  {
    // "get out" is dropped on purpose: it is a normal thing to exclaim at somebody, and
    // exclaiming it should not end the session for the whole room.
    phrases: ["leave", "everybody out", "clear the room"],
    effect: "leave",
    exact: true,
    announce: "{name} CLEARED THE ROOM",
  },

  // ---- easter eggs ----------------------------------------------------------------
  {
    // "oh no" and "brace" were here and had to go - both turn up constantly in a normal
    // conversation about a broken build, and shaking everyone's screen each time is not
    // a joke by the third repetition.
    phrases: ["earthquake", "shake it"],
    effect: "shake",
    announce: "SOMETHING IS HAPPENING",
  },
  {
    phrases: ["congrats", "congratulations", "promoted", "we did it", "happy birthday"],
    effect: "confetti",
    emote: "jump",
    announce: "{name} IS CELEBRATING",
  },
  {
    // Exact only. "I'll raise a ticket" should not rain confetti on the office.
    phrases: ["raise", "pay rise", "bonus"],
    effect: "confetti",
    exact: true,
    announce: "DENIED",
  },
  { phrases: ["hi", "hey", "hello", "yo", "morning", "sup"], emote: "wave" },
  { phrases: ["bye", "later", "see ya", "goodnight", "night"], emote: "wave" },
  { phrases: ["woo", "woohoo", "lets go", "amazing"], emote: "jump" },
  // The banner-only entries are all exact matches. They read as ordinary work words -
  // "status", "coffee", "deploy" - and as substrings they kept the announce strip up
  // continuously through a real conversation.
  {
    phrases: ["standup", "stand up", "quick call"],
    exact: true,
    announce: "{name} CALLED A STANDUP",
  },
  {
    phrases: ["coffee", "brew", "cuppa", "tea", "coffee run"],
    exact: true,
    announce: "{name} IS MAKING A ROUND",
  },
  {
    phrases: ["deploy", "ship it", "shipping", "release"],
    exact: true,
    announce: "{name} IS SHIPPING IT",
  },
  {
    phrases: ["get to work", "back to it", "heads down"],
    emote: "laptop",
    announce: "{name} MEANS BUSINESS",
  },
  {
    phrases: ["youre fired", "you are fired"],
    announce: "SOMEBODY IS IN TROUBLE",
  },
];

/** Lower-case, strip anything that is not a letter, digit or space, squash spaces. */
export function normalizeSaid(text: string): string {
  return text
    .toLowerCase()
    // Apostrophes close up rather than splitting the word: "let's" has to become "lets",
    // not "let s", or every contraction in the table is unreachable by its own spelling.
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The first entry the message triggers, or null.
 *
 * Phrases match on whole words, so "hi" fires on "hi there" but not on "this" - a
 * substring test made almost every message set something off.
 */
export function matchChatMagic(
  text: string,
  character: CharacterId,
  /** Zone ids the speaker is standing in, for `where`-gated phrases. */
  standingIn: readonly string[] = [],
): ChatMagic | null {
  const bare = normalizeSaid(text);
  const said = ` ${bare} `;
  for (const magic of CHAT_MAGIC) {
    if (magic.only && !magic.only.includes(character)) continue;
    if (magic.where && !standingIn.includes(magic.where)) continue;
    const hit = magic.exact
      ? magic.phrases.some((p) => bare === normalizeSaid(p))
      : magic.phrases.some((p) => said.includes(` ${normalizeSaid(p)} `));
    if (hit) return magic;
  }
  return null;
}
