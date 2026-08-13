/**
 * Runs every node-level suite and reports once.
 *
 * Each suite is a separate process on purpose: a suite that throws on import - a missing
 * compiled module, a typo in a path - takes itself down and nothing else, and the run
 * still tells you about the others. Chaining them with `&&` hides everything after the
 * first failure, which is the opposite of what you want from a test run.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(here)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

let failed = 0;
for (const suite of suites) {
  const res = spawnSync(process.execPath, [join(here, suite)], { stdio: "inherit" });
  if (res.status !== 0) failed++;
}

console.log(
  failed === 0
    ? `\nall ${suites.length} suites passed`
    : `\n${failed} of ${suites.length} suites failed`,
);
process.exit(failed === 0 ? 0 : 1);
