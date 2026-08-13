/**
 * Shared plumbing for the browser tests.
 *
 * Everything runs against a PRODUCTION build on a real server, not the dev server: the
 * dev server does not mind mistakes that `next build` refuses, and the whole point of
 * these tests is to check what will actually be deployed.
 *
 * Multiplayer runs on the same-browser driver (`?net=local`, a BroadcastChannel). Two
 * tabs of one browser context talk to each other through it exactly as two phones talk
 * through Supabase, so five pages in one context is a five-player office. That is what
 * makes "does everybody see everybody correctly" testable at all from here.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

/** The repo root, so the server starts there whatever directory the caller was in. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Fixed by default so a stray server is obvious rather than mysterious, but overridable:
 * a container can end up with a port wedged by a process that outlived its shell, and
 * "pick another one" beats spending ten minutes on a port you do not care about.
 */
export const PORT = Number(process.env.BUDS_TEST_PORT || 3210);
export const BASE = `http://127.0.0.1:${PORT}`;

/** A portrait phone, which is the shape this game is designed for. */
export const PHONE = { width: 390, height: 844 };

/**
 * Starts the server in its own process group.
 *
 * `next start` forks a worker, so killing the pid you were handed leaves the worker
 * holding the port. That bites in the worst possible way: the next run's health check
 * sees something answering on the port, decides the server is up, and tests the PREVIOUS
 * build - whose chunks the rebuild has already deleted, so the page loads and React
 * never hydrates. Detaching and signalling the whole group is what makes a run
 * independent of the one before it.
 */
export async function startServer() {
  await requireFreePort();
  const proc = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
    cwd: ROOT,
    detached: true,
  });
  proc.stopServer = () => stopServer(proc);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return proc;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  stopServer(proc);
  throw new Error("next start never came up");
}

export function stopServer(proc) {
  if (!proc || proc.killed) return;
  try {
    // Negative pid: the group, so the forked worker goes with it.
    process.kill(-proc.pid, "SIGKILL");
  } catch {
    try {
      proc.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
}

/** Refuses to start on top of something already listening, rather than testing it. */
async function requireFreePort() {
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(1500) });
  } catch {
    return; // nothing there, which is what we want
  }
  throw new Error(
    `something is already listening on ${PORT}. Kill it first - if it is a stray server ` +
      "from an earlier run it will be serving a build that no longer exists on disk.",
  );
}

/**
 * `CHROMIUM_PATH` points at a browser that is already on the machine. Playwright pins an
 * exact browser build per release and refuses anything else, which is a fight worth
 * skipping on a box that ships its own Chromium.
 */
export async function launch() {
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  return chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

/**
 * Opens the office as `name` and waits until the game is actually running.
 *
 * `?debug` installs the read-only test seam on window (see Game.init) and `?net=local`
 * keeps everything on the BroadcastChannel driver rather than reaching for Supabase,
 * which is unreachable from here anyway.
 */
export async function joinAs(context, name, { room = "TESTROOM", extra = "" } = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.errors = errors;

  await page.goto(`${BASE}/o/${room}?net=local&test=1${extra}`, { waitUntil: "load" });
  await page.fill(".field", name);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => Boolean(window.__buds), null, { timeout: 20_000 });
  await page.waitForSelector(".hud", { timeout: 20_000 });
  return page;
}

export const buds = (page, fn, arg) => page.evaluate(fn, arg);

/** Click, with the page brought forward first. See the note on `walk`. */
export async function tap(page, selector) {
  await page.bringToFront();
  await page.click(selector);
}

/**
 * Holds a key for `ms`, which is how you walk somewhere.
 *
 * `bringToFront` is not decoration. Several tests drive two or more tabs, and a
 * backgrounded tab in headless Chromium fails Playwright's actionability checks - the
 * element is there and rendered, and the click waits thirty seconds and then times out.
 */
export async function walk(page, key, ms) {
  await page.bringToFront();
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(60);
}

/**
 * Says something, and hands the HUD back.
 *
 * Sending does NOT close the composer - that is deliberate in the game, because you
 * usually have more than one thing to say - and while it is open the button row is not
 * rendered. So this opens it only if it is shut, and closes it afterwards, or the second
 * call in a row spends thirty seconds looking for a CHAT button that is not there.
 */
export async function say(page, text) {
  await page.bringToFront();
  if ((await page.locator(".composer").count()) === 0) await page.click(".round--chat");
  await page.fill(".composer .field", text);
  await page.press(".composer .field", "Enter");
  await page.waitForTimeout(180);
  await page.press(".composer .field", "Escape");
  await page.waitForTimeout(80);
}

// ---- the tiny assertion harness, shared with the node tests ----------------------
let passed = 0;
let failed = 0;

export function check(label, fn) {
  try {
    const r = fn();
    if (r instanceof Promise) throw new Error("check() is synchronous; await first");
    passed++;
    console.log(`  ok   ${label}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${label}\n       ${e.message}`);
  }
}

export function suite(name) {
  console.log(`\n${name}`);
}

export function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
  return failed;
}
