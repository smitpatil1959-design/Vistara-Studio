// Real integration test against an isolated account and a running local server.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { inspectDesign, validatePresentation } from '../server/spec/index.js';

process.loadEnvFile('.env.local');
const folder = '.test-build/backend';
const base = process.env.SMOKE_BASE_URL || 'http://localhost:4510';
const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: login, error } = await db.auth.signInWithPassword(JSON.parse(readFileSync(`${folder}/browser-account.json`, 'utf8')));
assert.ifError(error);
const auth = { Authorization: `Bearer ${login.session.access_token}`, 'Content-Type': 'application/json' };
const cases = [
  ['swiggy-college', 'https://www.swiggy.com/corporate/', 'college'],
  ['swiggy-investor', 'https://www.swiggy.com/corporate/', 'investor'],
  ['spotify', 'https://newsroom.spotify.com/company-info/', 'company_overview'],
  ['mit', 'https://www.mit.edu/', 'college'],
  ['flour', 'https://www.flourbakery.com/', 'company_overview'],
  ['apple', 'https://www.apple.com/iphone/', 'product-demo'],
];
async function api(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(new URL(path, base), { method, headers: auth, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(300000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${data.step || ''} ${data.message || data.error || ''}`.trim());
  return data;
}
async function run([key, url, purpose]) {
  const result = { key, url, purpose, passed: false };
  let step = 'create';
  try {
    const reuse = process.env.SMOKE_PROJECT_ID;
    const project = reuse
      ? await api(`/api/projects?id=${encodeURIComponent(reuse)}`)
      : await api('/api/projects', { url, purpose, designPrompt: 'Use clearly sourced information, an editorial presentation, and the website’s actual visual identity.' });
    assert.equal(project.url, url, 'Test project URL must match the benchmark');
    result.projectId = project.id;
    await api('/api/visibility', { projectId: project.id, visibility: 'private' }, 'PUT');
    step = 'analyze';
    const analyzed = reuse ? project : await api('/api/analyze', { projectId: project.id });
    result.provider = analyzed.understanding?.meta?.engine || null;
    result.crawlMode = analyzed.analysis?.crawlMode || analyzed.analysis?.crawlStatus;
    result.brand = analyzed.analysis?.brandKit && { primary: analyzed.analysis.brandKit.primaryColor, fallback: analyzed.analysis.brandKit.isFallback, confidence: analyzed.analysis.brandKit.confidence };
    step = 'generate';
    await api('/api/generate', { projectId: project.id });
    step = 'verify';
    const [{ spec }, { claims }] = await Promise.all([api(`/api/spec?projectId=${project.id}`), api(`/api/research?projectId=${project.id}&r=claims`)]);
    const validation = validatePresentation(spec);
    assert.ok(validation.valid, validation.errors.join('; '));
    assert.equal(spec.schemaVersion, 'presentation.v2');
    assert.ok(spec.slides.length >= 3);
    assert.ok(claims.length > 0);
    assert.ok(spec.slides.some(slide => slide.sources?.length));
    result.claims = claims.length;
    result.title = spec.name;
    result.slides = spec.slides.length;
    result.compositions = spec.slides.map(slide => slide.composition);
    result.citations = [...new Set(spec.slides.flatMap(slide => (slide.sources || []).map(source => source.url)))];
    result.titles = spec.slides.map(slide => slide.elements.find(el => el.content?.role === 'title')?.content.text);
    result.sample = claims.slice(0, 4).map(claim => ({ text: claim.claim, source: claim.sourceUrls?.[0] }));
    result.issues = inspectDesign(spec).map(issue => issue.kind);
    result.passed = true;
  } catch (error) { result.error = `${step}: ${error.message}`; }
  writeFileSync(`${folder}/v2-${key}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
}
const selected = process.argv.slice(2);
for (const item of cases.filter(item => !selected.length || selected.includes(item[0]))) await run(item);
