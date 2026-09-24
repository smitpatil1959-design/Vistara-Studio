process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

/* tiny zero-dep test harness — bundles TS once, runs *.test.mjs files in process order */

mkdirSync('.test-build', { recursive: true });
await build({
  entryPoints: ['src/deck-spec/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: '.test-build/deckspec.mjs',
  loader: { '.ts': 'ts' },
  logLevel: 'error',
});



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
  import('./spec.test.mjs'),
  import('./security.test.mjs'),
  import('./understanding.test.mjs'),
  import('./dna.test.mjs'),
  import('./director.test.mjs'),
  import('./artdirector.test.mjs'),
  import('./visual.test.mjs'),
  import('./story.test.mjs'),
  import('./layout.test.mjs'),
  import('./creativedirector.test.mjs'),
  import('./quality.test.mjs'),
  import('./motion.test.mjs'),
  import('./presentation-engine.test.mjs'),
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
