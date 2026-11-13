// Verifies the disposable deck edited through the browser. No credential output.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { inspectDesign } from '../server/spec/index.js';

process.loadEnvFile('.env.local');
const folder = '.test-build/backend', base = process.env.SMOKE_BASE_URL || 'http://localhost:4510';
const [projectId, expectedTitle, expectedNote] = process.argv.slice(2);
const outputName = process.env.SMOKE_EXPORT_NAME || 'v2-apple-workflow';
assert.match(outputName, /^[a-z0-9-]+$/i);
assert.match(projectId || '', /^[a-f0-9-]{36}$/i);
const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: login, error } = await db.auth.signInWithPassword(JSON.parse(readFileSync(`${folder}/browser-account.json`, 'utf8')));
assert.ifError(error);
const owner = { Authorization: `Bearer ${login.session.access_token}` };
const api = (path, headers = owner) => fetch(new URL(path, base), { headers, signal: AbortSignal.timeout(90000) });
const load = async path => { const res = await api(path); assert.equal(res.status, 200, path); return res.json(); };
const [project, { spec, version }, { claims }] = await Promise.all([
  load(`/api/projects?id=${projectId}`),
  load(`/api/spec?projectId=${projectId}`),
  load(`/api/research?projectId=${projectId}&r=claims`),
]);
assert.equal(spec.schemaVersion, 'presentation.v2');
assert.ok(spec.slides.some(slide => slide.composition));
const slideTitles = spec.slides.map(slide => slide.elements.find(element => element.content.role === 'title')?.content.text);
if (expectedTitle) assert.ok(slideTitles.includes(expectedTitle), 'Edited title was not saved');
if (expectedNote) assert.ok(spec.slides.some(slide => slide.notes?.includes(expectedNote)), 'Edited note was not saved');
const cited = [...new Set(spec.slides.flatMap(slide => (slide.sources || []).map(source => source.url)))];
assert.ok(cited.length);
const sessionId = project.analysis?.research?.sessionId;
const { data: currentClaims, error: claimsError } = sessionId
  ? await db.from('claims').select('id').eq('project_id', projectId).eq('research_session_id', sessionId)
  : { data: claims, error: null };
assert.ifError(claimsError);
const claimIds = new Set(currentClaims.map(claim => claim.id));
assert.ok(spec.slides.flatMap(slide => slide.sources || []).every(source => !source.claimId || claimIds.has(source.claimId)));
const report = await load(`/api/export-report?projectId=${projectId}&format=pptx`);
assert.equal(report.ready, true, JSON.stringify(report.findings.filter(finding => finding.severity === 'block')));
const exported = await api(`/api/export-pptx?projectId=${projectId}`);
assert.equal(exported.status, 200, await exported.clone().text().then(value => value.slice(0, 300)));
const buffer = Buffer.from(await exported.arrayBuffer());
const zip = await JSZip.loadAsync(buffer);
const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
assert.equal(slideFiles.length, spec.slides.length);
const text = await Promise.all(slideFiles.map(file => zip.file(file).async('string')));
if (expectedTitle) assert.ok(text.some(xml => xml.includes(expectedTitle)), 'PowerPoint did not contain the saved title');
const noteFiles = Object.keys(zip.files).filter(name => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
if (expectedNote) assert.ok((await Promise.all(noteFiles.map(file => zip.file(file).async('string')))).some(xml => xml.includes(expectedNote)));
const media = Object.keys(zip.files).filter(name => /^ppt\/media\/.+/.test(name));
if (spec.slides.some(slide => slide.elements.some(element => element.content.kind === 'image' && !element.hidden))) assert.ok(media.length);
const asset = project.analysis?.screenshot;
if (asset && (await load(`/api/visibility?projectId=${projectId}`)).visibility === 'private') {
  assert.equal((await api(asset, {})).status, 404);
  assert.equal((await api(asset)).status, 200);
}
const result = { projectId, version, title: spec.name, slides: spec.slides.length, slideTitles, cited, claims: claimIds.size, provider: project.understanding?.meta?.engine, brand: spec.brand?.primaryColor, fallback: spec.brand?.isFallback, issues: inspectDesign(spec), pptxBytes: buffer.length, media: media.length, notes: noteFiles.length, readiness: report.counts, expectedTitle, expectedNote };
writeFileSync(`${folder}/${outputName}.pptx`, buffer);
writeFileSync(`${folder}/${outputName}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
