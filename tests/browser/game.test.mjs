/**
 * The whole game, in a real browser, against a real production build.
 *
 * The suite is shaped by the two bugs that got out. One: over a real connection every
 * peer decoded as one of the two characters that existed when the decoder was written,
 * so three of the five wore somebody else's face - and nothing caught it because every
 * test used the other transport. Two: three of the five had no emotes at all, which no
 * test could have caught because no test asked what a character could DO.
 *
 * So the rule here is that anything checked for one character is checked for all five,
 * by name, and anything checked locally is also checked from a peer's screen.
 */
import assert from "node:assert/strict";

import {
  PHONE,
  buds,
  check,
  joinAs,
  launch,
  report,
  say,
  startServer,
  stopServer,
  suite,
  tap,
  walk,
} from "./harness.mjs";

const CAST = [
  ["COLIN", "colin"],
  ["MICHAEL", "michael"],
  ["ALEXIS", "alexis"],
  ["MELANIE", "melanie"],
  ["TIFFANY", "tiffany"],
];

const server = await startServer();
const browser = await launch();

/**
 * Everything below runs inside this, so a thrown assertion still shuts the server down.
 * Without it a crashed run leaves `next start` holding the port, and the NEXT run either
 * refuses to start or - worse, before the port guard existed - silently tests the build
 * that crashed.
 */
process.on("exit", () => stopServer(server));
process.on("uncaughtException", (e) => {
  console.error(e);
  stopServer(server);
  process.exit(1);
});

/** Fresh context per scenario: a shared BroadcastChannel is what makes tabs peers. */
const scenario = async (fn) => {
  const ctx = await browser.newContext({ viewport: PHONE });
  try {
    return await fn(ctx);
  } finally {
    await ctx.close();
  }
};

const local = (players) => players.find((p) => p.isLocal);
const noisyErrors = (page) =>
  page.errors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED/i.test(e));

// ---------------------------------------------------------------------------------
suite("every character walks in as themselves");

for (const [name, id] of CAST) {
  const result = await scenario(async (ctx) => {
    const page = await joinAs(ctx, name);
    const players = await buds(page, () => window.__buds.players());
    const emotes = await buds(page, () => window.__buds.emotes());
    const room = await buds(page, () => window.__buds.room());
    return { players, emotes, room, errors: noisyErrors(page) };
  });

  check(`${name} is ${id}`, () => {
    const me = local(result.players);
    assert.ok(me, `${name} is not in the player list at all`);
    assert.equal(me.name, name);
    assert.equal(me.character, id);
  });

  check(`${name} starts in the office`, () => {
    assert.equal(result.room, "office");
  });

  check(`${name} is offered a full set of emotes`, () => {
    assert.ok(
      result.emotes.length >= 6,
      `${name} only gets ${result.emotes.length}: ${result.emotes.join(", ")}`,
    );
  });

  check(`${name} loads with no console errors`, () => {
    assert.deepEqual(result.errors, []);
  });
}

// ---------------------------------------------------------------------------------
suite("every emote actually plays, for everyone");

for (const [name] of CAST) {
  const played = await scenario(async (ctx) => {
    const page = await joinAs(ctx, name);
    const clips = await buds(page, () => window.__buds.emotes());
    const out = [];
    for (const clip of clips) {
      // Open the tray, tap the emote, read back what the game is playing.
      await tap(page, '.hud__bottomright .round:has-text("EMOTE")');
      await tap(page, `.tray .round:has-text("${labelFor(clip)}")`);
      // Wait for the state rather than sleeping at it. A fixed pause raced the frame
      // that clears an emote when you are still moving, and failed about one run in ten
      // on whichever emote happened to follow a long one.
      const playing = await page
        .waitForFunction(
          (want) => window.__buds.players().find((p) => p.isLocal)?.emote === want,
          clip,
          { timeout: 2500 },
        )
        .then(() => clip)
        .catch(async () => local(await buds(page, () => window.__buds.players())).emote);
      out.push([clip, playing]);
      // A faint holds until you move, so shake it off before the next one.
      await walk(page, "ArrowUp", 90);
    }
    return { out, errors: noisyErrors(page) };
  });

  check(`${name} can play all of them`, () => {
    for (const [clip, playing] of played.out) {
      assert.equal(playing, clip, `tapping ${clip} set emote to "${playing}"`);
    }
  });

  check(`${name} emotes without errors`, () => {
    assert.deepEqual(played.errors, []);
  });
}

/** The tray buttons are labelled, not named by clip. Mirrors EMOTES in core/emotes.ts. */
function labelFor(clip) {
  return { wave: "WAVE", jump: "JUMP", dance: "DANCE", spin: "SPIN", panic: "PANIC", faint: "FAINT", laptop: "WORK" }[clip] ?? clip.toUpperCase();
}

// ---------------------------------------------------------------------------------
suite("five in one office, seen from every screen");

const everyone = await scenario(async (ctx) => {
  const pages = [];
  for (const [name] of CAST) pages.push(await joinAs(ctx, name));
  // Presence needs a heartbeat or two to settle.
  await pages[0].waitForTimeout(1600);
  const views = [];
  for (const page of pages) {
    views.push({
      me: local(await buds(page, () => window.__buds.players())),
      all: await buds(page, () => window.__buds.players()),
      errors: noisyErrors(page),
    });
  }
  return views;
});

check("everybody can see everybody", () => {
  for (const view of everyone) {
    assert.equal(view.all.length, CAST.length, `${view.me.name} sees ${view.all.length} people`);
  }
});

check("everybody sees everybody else wearing the right face", () => {
  // THE regression. Melanie must look like Melanie on Colin's screen, not like Colin.
  const expected = new Map(CAST.map(([name, id]) => [name, id]));
  for (const view of everyone) {
    for (const p of view.all) {
      assert.equal(
        p.character,
        expected.get(p.name),
        `on ${view.me.name}'s screen, ${p.name} is drawn as ${p.character}`,
      );
    }
  }
});

check("no two people are given the same id", () => {
  for (const view of everyone) {
    const ids = view.all.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `${view.me.name} sees duplicate ids`);
  }
});

check("everyone is in the same room", () => {
  for (const view of everyone) {
    for (const p of view.all) assert.equal(p.room, "office");
  }
});

check("a five-way office logs no errors", () => {
  for (const view of everyone) assert.deepEqual(view.errors, []);
});

// ---------------------------------------------------------------------------------
suite("talking");

const talk = await scenario(async (ctx) => {
  const colin = await joinAs(ctx, "COLIN");
  const mel = await joinAs(ctx, "MELANIE");
  await colin.waitForTimeout(900);

  await say(colin, "hello melanie");
  await colin.waitForTimeout(300);
  const heard = await mel.textContent(".history").catch(() => null);
  await tap(mel, '.hud__bottomright .round:has-text("LOG")');
  const log = await mel.textContent(".history");

  // A phrase everybody can act on, gated to an exact match.
  await say(colin, "synergy");
  await colin.waitForTimeout(400);
  const colinEmote = local(await buds(colin, () => window.__buds.players())).emote;
  const melEmote = local(await buds(mel, () => window.__buds.players())).emote;
  const banner = await mel.textContent(".announce").catch(() => "");

  return { log, heard, colinEmote, melEmote, banner, errors: [...noisyErrors(colin), ...noisyErrors(mel)] };
});

check("what one person says turns up in the other's log", () => {
  assert.match(talk.log, /hello melanie/i);
  assert.match(talk.log, /COLIN/);
});

check("the room-wide reaction reaches everybody, not just the speaker", () => {
  assert.equal(talk.colinEmote, "faint", "the speaker did not react");
  assert.equal(talk.melEmote, "faint", "the listener did not react");
});

check("the banner is shown to the people who did not type it", () => {
  assert.match(talk.banner, /SOMEBODY SAID IT/i);
});

check("talking logs no errors", () => {
  assert.deepEqual(talk.errors, []);
});

// ---------------------------------------------------------------------------------
suite("the floor plan");

const plan = await scenario(async (ctx) => {
  const page = await joinAs(ctx, "COLIN");

  // Walls block. Put Colin in the kitchen above a solid stretch of the wall that divides
  // the north band from the hallway, walk down hard, and he should still be above it.
  await buds(page, () => window.__buds.place(104, 120));
  await walk(page, "ArrowDown", 900);
  const stopped = local(await buds(page, () => window.__buds.players()));

  // Doorways do not. The kitchen's doorway onto the hallway is at x 160..192.
  await buds(page, () => window.__buds.place(168, 120));
  await walk(page, "ArrowDown", 1100);
  const through = local(await buds(page, () => window.__buds.players()));

  // Something to pick up, and putting it back: the keyboard on Colin's own desk.
  await buds(page, () => window.__buds.place(296, 62));
  await page.waitForTimeout(350);
  const reach = await buds(page, () => window.__buds.reach());
  let carrying = -1;
  if (reach) {
    await tap(page, ".round--act");
    await page.waitForTimeout(200);
    carrying = local(await buds(page, () => window.__buds.players())).carrying;
    await tap(page, ".round--act");
    await page.waitForTimeout(200);
  }
  const dropped = local(await buds(page, () => window.__buds.players())).carrying;

  return { stopped, through, reach, carrying, dropped, errors: noisyErrors(page) };
});

check("a wall stops you", () => {
  assert.ok(plan.stopped.y <= 132, `walked through the wall to y=${plan.stopped.y}`);
});

check("a doorway lets you through", () => {
  assert.ok(plan.through.y > 150, `did not get through the doorway, stuck at y=${plan.through.y}`);
});

check("there is something to pick up on a desk", () => {
  assert.ok(plan.reach, "nothing within reach beside a desk");
  assert.equal(plan.reach.action, "take");
});

check("picking up and putting down both work", () => {
  assert.ok(plan.carrying >= 0, "picked nothing up");
  assert.equal(plan.dropped, -1, "could not put it down again");
});

check("walking around logs no errors", () => {
  assert.deepEqual(plan.errors, []);
});

// ---------------------------------------------------------------------------------
suite("finding your way around a building");

const nav = await scenario(async (ctx) => {
  const page = await joinAs(ctx, "COLIN");
  const rooms = [];
  for (const [label, x, y] of [
    ["HANG OUT ROOM", 40, 80],
    ["KITCHEN", 136, 80],
    ["MARKETING", 312, 80],
    ["MICHAEL'S OFFICE", 40, 192],
    ["PRINT ROOM", 312, 176],
    ["CONFERENCE ROOM", 168, 400],
    ["THE HALLWAY", 168, 160],
  ]) {
    await buds(page, (p) => window.__buds.place(p[0], p[1]), [x, y]);
    await page.waitForTimeout(120);
    rooms.push([label, await buds(page, () => window.__buds.here())]);
  }

  // The whole floor at once, and back.
  const before = await buds(page, () => window.__buds.zoomedOut());
  await tap(page, '.hud__bottomright .round:has-text("WHOLE FLOOR")');
  await page.waitForTimeout(250);
  const zoomed = await buds(page, () => window.__buds.zoomedOut());
  await tap(page, '.hud__bottomright .round:has-text("CLOSE UP")');
  await page.waitForTimeout(250);
  const back = await buds(page, () => window.__buds.zoomedOut());

  return { rooms, before, zoomed, back, errors: noisyErrors(page) };
});

check("the HUD names the room you are standing in", () => {
  for (const [expected, actual] of nav.rooms) {
    assert.equal(actual, expected, `stood in ${expected} and the HUD said ${actual}`);
  }
});

check("the whole-floor view toggles both ways", () => {
  assert.equal(nav.before, false);
  assert.equal(nav.zoomed, true, "WHOLE FLOOR did not zoom out");
  assert.equal(nav.back, false, "CLOSE UP did not come back");
});

check("getting around logs no errors", () => {
  assert.deepEqual(nav.errors, []);
});

// ---------------------------------------------------------------------------------
suite("going outside, and coming back");

const trip = await scenario(async (ctx) => {
  const colin = await joinAs(ctx, "COLIN");
  const tiff = await joinAs(ctx, "TIFFANY");
  await colin.waitForTimeout(900);

  // The spoken invitation takes the whole room, which is the point of it.
  await say(colin, "lets go outside");
  await colin.waitForTimeout(2200);
  const after = {
    colin: await buds(colin, () => window.__buds.room()),
    tiff: await buds(tiff, () => window.__buds.room()),
  };

  // And back in, this time by walking into the way home.
  await say(colin, "lets go inside");
  await colin.waitForTimeout(2200);
  const home = {
    colin: await buds(colin, () => window.__buds.room()),
    tiff: await buds(tiff, () => window.__buds.room()),
  };

  return { after, home, errors: [...noisyErrors(colin), ...noisyErrors(tiff)] };
});

check("saying the words takes everyone outside", () => {
  assert.equal(trip.after.colin, "grove");
  assert.equal(trip.after.tiff, "grove", "Tiffany was left behind in the office");
});

check("and brings everyone back", () => {
  assert.equal(trip.home.colin, "office");
  assert.equal(trip.home.tiff, "office", "Tiffany was left outside");
});

check("the round trip logs no errors", () => {
  assert.deepEqual(trip.errors, []);
});

// ---------------------------------------------------------------------------------
suite("the rite, which only Colin can work");

const rite = await scenario(async (ctx) => {
  const colin = await joinAs(ctx, "COLIN", { extra: "&room=grove" });
  const mel = await joinAs(ctx, "MELANIE", { extra: "&room=grove" });
  await colin.waitForTimeout(900);

  // Melanie on the stone: the words must do nothing.
  await buds(mel, () => window.__buds.place(88, 140));
  await say(mel, "i summon thee");
  await mel.waitForTimeout(400);
  const melTried = await buds(mel, () => window.__buds.summoned());

  // Colin off the stone: also nothing.
  await buds(colin, () => window.__buds.place(88, 210));
  await say(colin, "i summon thee");
  await colin.waitForTimeout(400);
  const offStone = await buds(colin, () => window.__buds.summoned());

  // Colin on the stone: something answers.
  await buds(colin, () => window.__buds.place(88, 140));
  await say(colin, "i summon thee");
  await colin.waitForTimeout(500);
  const onStone = await buds(colin, () => window.__buds.summoned());
  const seenByMel = await buds(mel, () => window.__buds.summoned());

  return { melTried, offStone, onStone, seenByMel, errors: [...noisyErrors(colin), ...noisyErrors(mel)] };
});

check("Melanie on the stone summons nothing", () => {
  assert.equal(rite.melTried, false);
});

check("Colin off the stone summons nothing", () => {
  assert.equal(rite.offStone, false);
});

check("Colin on the stone summons something", () => {
  assert.equal(rite.onStone, true);
});

check("and everyone else sees it too", () => {
  assert.equal(rite.seenByMel, true);
});

check("the rite logs no errors", () => {
  assert.deepEqual(rite.errors, []);
});

// ---------------------------------------------------------------------------------
suite("ways michael can die");

const doom = await scenario(async (ctx) => {
  const colin = await joinAs(ctx, "COLIN");
  const mike = await joinAs(ctx, "MICHAEL");
  await colin.waitForTimeout(900);

  // Stand them together - you have to walk up to somebody to do this.
  await buds(colin, () => window.__buds.place(168, 300));
  await buds(mike, () => window.__buds.place(180, 300));
  await colin.waitForTimeout(500);

  const offered = await buds(colin, () => window.__buds.victim());
  await tap(colin, '.hud__bottomright .round:has-text("END MICHAEL")');
  await colin.waitForTimeout(150);
  await tap(colin, '.tray--doom .round:has-text("PRINTER")');
  await colin.waitForTimeout(600);

  const onMikesScreen = (await buds(mike, () => window.__buds.players())).find((p) => p.isLocal);
  const seenByColin = (await buds(colin, () => window.__buds.players())).find((p) => !p.isLocal);
  const banner = await colin.textContent(".announce").catch(() => "");

  // The dead do not walk.
  const before = onMikesScreen.x;
  await walk(mike, "ArrowLeft", 700);
  const after = (await buds(mike, () => window.__buds.players())).find((p) => p.isLocal).x;

  // And getting up is one tap.
  await tap(mike, '.hud__bottomright .round:has-text("GET UP")');
  await mike.waitForTimeout(600);
  const risen = (await buds(colin, () => window.__buds.players())).find((p) => !p.isLocal);
  await walk(mike, "ArrowLeft", 500);
  const moved = (await buds(mike, () => window.__buds.players())).find((p) => p.isLocal).x;

  return {
    offered,
    onMikesScreen,
    seenByColin,
    banner,
    stuck: before === after,
    risen,
    walkedAfter: moved !== before,
    errors: [...noisyErrors(colin), ...noisyErrors(mike)],
  };
});

check("standing next to somebody offers them a way out", () => {
  assert.equal(doom.offered?.name, "MICHAEL");
});

check("the victim goes down, on their own screen and everyone else's", () => {
  assert.ok(doom.onMikesScreen.dead >= 0, "Michael does not think he is dead");
  assert.ok(doom.seenByColin.dead >= 0, "Colin cannot see that Michael is dead");
  assert.equal(doom.onMikesScreen.dead, doom.seenByColin.dead, "they disagree about the cause");
});

check("everyone gets the headline", () => {
  assert.match(doom.banner, /MICHAEL WAS EATEN BY THE PRINTER/i);
});

check("the dead do not walk", () => {
  assert.ok(doom.stuck, "walked away while dead");
});

check("getting up works, and is visible to everyone", () => {
  assert.equal(doom.risen.dead, -1, "Colin still sees a body");
  assert.ok(doom.walkedAfter, "could not move again after getting up");
});

check("dying logs no errors", () => {
  assert.deepEqual(doom.errors, []);
});

await browser.close();
stopServer(server);
report();
