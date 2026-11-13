import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { buildSpecFromSlides } from '../server/spec/index.js';
import { buildPptx } from '../server/export/pptx.js';
import { protectAssetUrls, assetUrl, managedAsset, validAssetTarget, requestToken } from '../server/assetAccess.js';
import { pickInternal } from '../server/browserCrawl.js';
import { isHighQualityContent } from '../server/presentation/extractionQuality.js';
import { llmAvailable, llmComplete } from '../server/understanding/llm.js';

test('www sites discover subpages and browser fallback notices are excluded', () => {
  assert.deepEqual(pickInternal([{ url: 'https://www.python.org/about/' }, { url: 'https://elsewhere.test/about' }], 'www.python.org', 4), ['https://www.python.org/about/']);
  assert.equal(isHighQualityContent('This page displays a fallback because interactive scripts did not run.'), false);
  assert.equal(isHighQualityContent('Python can be used on many operating systems and environments.'), true);
});

test('NVIDIA uses the selected provider and no-key mode makes no model requests', async context => {
  const oldProvider = process.env.AI_PROVIDER, oldKey = process.env.NVIDIA_API_KEY;
  let calls = 0, truncated = false;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.stream, false);
    assert.equal(body.reasoning_effort, 'none');
    return Response.json({ choices: [{ finish_reason: truncated ? 'length' : 'stop', message: { content: '{"supported":true}' } }] });
  });
  try {
    process.env.AI_PROVIDER = 'nvidia'; process.env.NVIDIA_API_KEY = 'test-only';
    assert.equal(llmAvailable(), true);
    assert.equal((await llmComplete('Ground all content', 'Public source')).engine, 'nvidia');
    truncated = true;
    await assert.rejects(llmComplete('Ground all content', 'Public source'), /output limit/);
    process.env.AI_PROVIDER = 'none';
    assert.equal(llmAvailable(), false);
    await assert.rejects(llmComplete('Test', 'Test'), /no provider configured/);
    assert.equal(calls, 2);
  } finally {
    if (oldProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = oldProvider;
    if (oldKey === undefined) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = oldKey;
  }
});

mkdirSync('.test-build/backend', { recursive: true });
await build({ entryPoints: ['src/lib/documentSaver.ts'], outfile: '.test-build/backend/documentSaver.mjs', format: 'esm', bundle: true, platform: 'node' });
const { DocumentSaver } = await import(pathToFileURL(resolve('.test-build/backend/documentSaver.mjs')).href);
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('autosave serializes edits made during a slow save and never labels the stale document saved', async () => {
  const gate = deferred(), calls = [], states = [];
  const saver = new DocumentSaver(async (doc, version) => { calls.push({ doc, version }); if (calls.length === 1) await gate.promise; return version + 1; }, state => states.push(state));
  saver.setVersion(4);
  saver.note('first'); const pending = saver.flush();
  saver.note('second'); saver.note('latest');
  assert.equal(saver.flush(), pending);
  assert.equal(states.includes('saved'), false);
  gate.resolve(); assert.equal(await pending, 6);
  assert.deepEqual(calls, [{ doc: 'first', version: 4 }, { doc: 'latest', version: 5 }]);
  assert.equal(states.filter(state => state === 'saved').length, 1);
  assert.equal(saver.dirty, false);
});

test('autosave retains the newest edit on network failure and waits for a successful retry', async () => {
  const gate = deferred(), calls = [];
  let fail = true;
  const saver = new DocumentSaver(async doc => { calls.push(doc); if (fail) { await gate.promise; throw new Error('Offline'); } return 1; }, () => {});
  saver.note('old'); const pending = saver.flush(); saver.note('new'); gate.resolve();
  await assert.rejects(pending, /Offline/);
  assert.equal(saver.dirty, true); fail = false;
  await saver.flush(); assert.deepEqual(calls, ['old', 'new']); assert.equal(saver.dirty, false);
});

test('managed images are rewritten into access-checked URLs and cannot cross project boundaries', () => {
  const projectId = randomUUID(), other = randomUUID();
  const previous = process.env.SUPABASE_URL; process.env.SUPABASE_URL = 'https://storage.example.test';
  try {
    const value = { nested: [{ src: `https://storage.example.test/storage/v1/object/public/assets/${projectId}/main.jpg` }] };
    const secured = protectAssetUrls(value).nested[0].src;
    assert.equal(secured, assetUrl(projectId, `${projectId}/main.jpg`));
    assert.equal(validAssetTarget(managedAsset(secured), projectId), true);
    assert.equal(validAssetTarget(managedAsset(secured), other), false);
    assert.equal(validAssetTarget({ projectId, bucket: 'assets', path: `${projectId}/../other.jpg` }), false);
    assert.equal(requestToken({ headers: { cookie: 'vistara_session=test-token' } }), 'test-token');
  } finally { if (previous === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous; }
});

test('PowerPoint renders groups, icons, charts, buttons and positioned content into a valid deck', async () => {
  const pid = randomUUID();
  const spec = buildSpecFromSlides({ id: pid, name: 'Python', url: 'https://www.python.org', theme: {} }, [{ id: randomUUID(), type: 'hero', title: 'Python real content', body: 'Python is a programming language.', bullets: [], stats: [] }], 'generated');
  const element = (kind, content, position = { mode: 'absolute', x: 80, y: 300 }) => ({ id: randomUUID(), type: kind, content: { kind, ...content }, position, size: { w: 420, h: 180 }, style: {}, animation: { preset: 'none', delayMs: 0 }, metadata: {} });
  spec.slides[0].elements.push(
    element('icon', { name: 'star', pack: 'lucide' }, { mode: 'absolute', x: 1000, y: 80 }),
    element('button', { label: 'Visit Python', href: 'https://www.python.org', variant: 'primary' }),
    element('group', { children: [element('text', { role: 'body', text: 'Grouped source content' }, { mode: 'flow', slot: 'body' }), element('shape', { shape: 'circle' }, { mode: 'flow', slot: 'decoration' })] }, { mode: 'absolute', x: 600, y: 300 }),
    element('chart', { chart: 'bars', series: [{ label: 'Measured A', value: 10 }, { label: 'Measured B', value: 20 }] }, { mode: 'flow', slot: 'decoration' }),
  );
  const pptx = await buildPptx(spec);
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(xml, /Grouped source content/); assert.match(xml, /Visit Python/); assert.match(xml, /Python real content/);
  assert.ok(Object.keys(zip.files).some(name => name.startsWith('ppt/media/') && name.endsWith('.png')));
  assert.ok(Object.keys(zip.files).some(name => name.startsWith('ppt/charts/') && name.endsWith('.xml')));
});
