import assert from 'node:assert/strict';

const results = [];
const tasks = [];
globalThis.t = (name, fn) => {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      const p = r.then(
        () => results.push({ name, ok: true }),
        (e) => results.push({ name, ok: false, err: e })
      );
      tasks.push(p);
    } else {
      results.push({ name, ok: true });
    }
  } catch (e) {
    results.push({ name, ok: false, err: e });
  }
};
globalThis.assert = assert;

await Promise.all([
  import('../tests/spec.test.mjs'),
  import('../tests/security.test.mjs'),
  import('../tests/understanding.test.mjs'),
  import('../tests/dna.test.mjs'),
  import('../tests/director.test.mjs'),
  import('../tests/artdirector.test.mjs'),
  import('../tests/visual.test.mjs'),
  import('../tests/story.test.mjs'),
  import('../tests/layout.test.mjs'),
  import('../tests/creativedirector.test.mjs'),
  import('../tests/quality.test.mjs'),
  import('../tests/motion.test.mjs'),
]);

await Promise.all(tasks);

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`  ✓ ${r.name}`);
  else {
    failed++;
    console.log(`  ✗ ${r.name}\n    → ${r.err?.message || r.err}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} tests passed${failed ? ` · ${failed} FAILED` : ''}`);
process.exitCode = failed ? 1 : 0;
