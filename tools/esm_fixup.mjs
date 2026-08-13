/**
 * Adds the .js that TypeScript's bundler resolution leaves off.
 *
 * `tsc` emits `from "../types"` under bundler resolution, which node's ESM loader will
 * not resolve. The alternative is a second tsconfig for tests; rewriting three import
 * lines is the smaller thing to maintain.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: esm_fixup.mjs <dir>");
  process.exit(1);
}

let patched = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path);
    } else if (path.endsWith(".js")) {
      const before = readFileSync(path, "utf8");
      const after = before.replace(
        /(\bfrom\s+["'])(\.[^"']*?)(["'])/g,
        (m, a, spec, b) => (spec.endsWith(".js") ? m : `${a}${spec}.js${b}`),
      );
      if (after !== before) {
        writeFileSync(path, after);
        patched++;
      }
    }
  }
};

walk(root);

// Node decides CommonJS-or-ESM from the nearest package.json, and the repo's says
// nothing. Without this every import prints a reparse warning that buries the test
// output it is mixed into.
writeFileSync(join(root, "package.json"), '{"type":"module"}\n');

console.log(`esm fixup: patched ${patched} file(s)`);
