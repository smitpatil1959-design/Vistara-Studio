#!/usr/bin/env node
/**
 * Builds the canonical Presentation Specification → server/spec/index.js.
 * The TypeScript source under src/deck-spec/ remains the ONE implementation;
 * this emits the runtime artifact the serverless functions import.
 */
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('server/spec', { recursive: true });
await build({
  entryPoints: ['src/deck-spec/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'server/spec/index.js',
  loader: { '.ts': 'ts' },
  logLevel: 'error',
});

writeFileSync('server/spec/README.txt', 'GENERATED — do not edit by hand. Source: src/deck-spec/*.ts (run npm run build or node scripts/build-spec.mjs)\n');
console.log('[spec-build] server/spec/index.js regenerated');

