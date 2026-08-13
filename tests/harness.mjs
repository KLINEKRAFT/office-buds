/**
 * A three-function test harness.
 *
 * There is no test framework here on purpose. What these tests need is to import a few
 * compiled modules and assert on what they return; a runner would be more setup than
 * subject. If this ever grows past a few hundred assertions, swap it for node:test.
 */
let passed = 0;
let failed = 0;

export function suite(name) {
  console.log(`\n${name}`);
}

export function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${label}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${label}\n       ${e.message}`);
  }
}

export function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
  return failed;
}
