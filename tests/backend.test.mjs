import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-key';
delete process.env.OPENAI_API_KEY;

const projectId = randomUUID();
const slideId = randomUUID();
const project = () => ({ id: projectId, user_id: 'owner', name: 'Example', url: 'https://example.com', status: 'generated', analysis: { title: 'Example', description: 'Example provides workflow tools for growing teams.' }, theme: {}, updated_at: new Date().toISOString() });
const slide = () => ({ id: slideId, project_id: projectId, sort_order: 10, type: 'hero', title: 'Original title', body: 'Original content', bullets: [], stats: [] });

function database(tables = {}, fail = () => null) {
  const rows = { projects: [project()], slides: [slide()], project_specs: [], project_intake: [{ project_id: projectId, purpose: 'investor_research' }], project_visibility: [], project_events: [], chat_messages: [], research_sessions: [], ...structuredClone(tables) };
  const calls = [];
  const db = {
    rows, calls,
    auth: { getUser: async token => ({ data: { user: token === 'owner-token' ? { id: 'owner' } : null }, error: null }) },
    from(table) {
      const query = { table, operation: 'select', filters: [], fields: null, payload: null, one: false, limit: Infinity };
      const chain = {
        select(fields = '*') { query.fields = fields; return chain; },
        eq(key, value) { query.filters.push(row => row[key] === value); return chain; },
        in(key, values) { query.filters.push(row => values.includes(row[key])); return chain; },
        order(key, { ascending = true } = {}) { query.sort = { key, ascending }; return chain; }, limit(value) { query.limit = value; return chain; },
        maybeSingle() { query.one = true; return chain; }, single() { query.one = true; return chain; },
        insert(payload) { query.operation = 'insert'; query.payload = payload; return chain; },
        update(payload) { query.operation = 'update'; query.payload = payload; return chain; },
        delete() { query.operation = 'delete'; return chain; },
        upsert(payload) { query.operation = 'upsert'; query.payload = payload; return chain; },
        then(onFulfilled, onRejected) {
          return Promise.resolve().then(() => {
            calls.push(query);
            const error = fail(query);
            if (error) return { data: null, error };
            rows[table] ||= [];
            let selected = rows[table].filter(row => query.filters.every(fn => fn(row)));
            if (query.sort) selected.sort((a, b) => (a[query.sort.key] > b[query.sort.key] ? 1 : a[query.sort.key] < b[query.sort.key] ? -1 : 0) * (query.sort.ascending ? 1 : -1));
            selected = selected.slice(0, query.limit);
            if (query.operation === 'update') selected.forEach(row => Object.assign(row, structuredClone(query.payload)));
            if (query.operation === 'delete') rows[table] = rows[table].filter(row => !selected.includes(row));
            if (query.operation === 'insert' || query.operation === 'upsert') {
              selected = (Array.isArray(query.payload) ? query.payload : [query.payload]).map(row => ({ id: randomUUID(), ...structuredClone(row) }));
              rows[table].push(...selected);
            }
            return { data: structuredClone(query.one ? selected[0] || null : selected), error: null };
          }).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
    async rpc(name, payload) {
      const query = { table: name, operation: 'rpc', payload };
      calls.push(query);
      const error = fail(query);
      if (error) return { data: null, error };
      const existing = rows.project_specs.find(row => row.project_id === payload.p_project_id);
      const version = (existing?.version || 0) + 1;
      rows.slides = [...rows.slides.filter(row => row.project_id !== payload.p_project_id), ...structuredClone(payload.p_slides)];
      rows.project_specs = [...rows.project_specs.filter(row => row.project_id !== payload.p_project_id), { project_id: payload.p_project_id, spec: payload.p_spec, version }];
      if (payload.p_generated) rows.projects.find(row => row.id === payload.p_project_id).status = 'generated';
      return { data: version, error: null };
    },
  };
  return db;
}

const dbStub = `export default new Proxy({}, { get(_, key) { const value = globalThis.__backendDb[key]; return typeof value === 'function' ? value.bind(globalThis.__backendDb) : value; } });`;
const engineStub = `export const analyzeWebsite = (...a) => globalThis.__backendMocks.analyzeWebsite(...a); export const applyCommand = () => ({ops: [], changes: []}); export const executeOps = async () => {};`;
const claimsStub = `export const getVerifiedClaims = async () => globalThis.__backendMocks.claims;`;
const plannerStub = `export const canonicalizePurpose = x => x; export const planPresentation = async () => { if (globalThis.__backendMocks.planError) throw new Error('Planner failed'); return {}; }; export const buildSlidesFromClaims = async () => [{type: 'hero', title: 'Replacement title', body: 'Grounded replacement', bullets: [], stats: []}];`;
mkdirSync('.test-build/backend', { recursive: true });
async function bundled(entry, stubs = {}) {
  const outfile = `.test-build/backend/${entry.replace(/[^a-z0-9]/gi, '-')}.mjs`;
  await build({
    entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile, logLevel: 'error',
    plugins: [{ name: 'backend-test-dependencies', setup(b) {
      b.onLoad({ filter: /\.js$/ }, args => {
        const normalized = args.path.replaceAll('\\', '/');
        if (normalized.endsWith('/db-client.js')) return { contents: dbStub, loader: 'js' };
        for (const [suffix, contents] of Object.entries(stubs)) if (normalized.endsWith(suffix)) return { contents, loader: 'js' };
      });
    } }],
  });
  return import(pathToFileURL(resolve(outfile)).href);
}
const { default: slidesHandler } = await bundled('server/api/slides.js');
const { default: assetHandler } = await bundled('server/api/asset-file.js');
const { extractEvidenceFromCrawl } = await bundled('server/evidenceExtraction.js');
const { getVerifiedClaims: realGetClaims } = await bundled('server/claimEngine.js');
const { default: specHandler } = await bundled('server/api/spec.js');
const { default: themeHandler } = await bundled('server/api/theme.js');
const { default: chatHandler } = await bundled('server/api/chat.js');
const { default: presentationHandler } = await bundled('server/api/presentation.js');
const { default: projectsHandler } = await bundled('server/api/projects.js');
const { default: generateHandler } = await bundled('server/api/generate.js', { '/engine.js': engineStub, '/claimEngine.js': claimsStub, '/presentationPlanner.js': plannerStub });
const { executeOps: executeRealOps } = await bundled('server/engine.js', { '/claimEngine.js': claimsStub, '/presentationPlanner.js': plannerStub });
const { default: analyzeHandler } = await bundled('server/api/analyze.js', { '/engine.js': engineStub, '/researchOrchestrator.js': `export const orchestrateResearch = async () => { throw new Error('Research persistence failed'); };` });
const { default: router } = await import('../api/[...route].js');
const { buildSpecFromSlides } = await import('../server/spec/index.js');
const { ensureDeckAccess, getVisibility } = await import('../server/visibility.js');
const { claimPipeline } = await import('../server/pipeline.js');
const { areContradictory } = await import('../server/claimEngine.js');
const { optimizeImage } = await import('../server/assets.js');
const { buildReadinessReport } = await import('../server/export/readiness.js');
const { fetchExportImage } = await bundled('server/export/remoteImage.js', { '/security.js': `export const safeDispatcher = undefined; export async function validateTarget(url) { if (new URL(url).hostname === '127.0.0.1') throw new Error('Private target blocked'); return {url}; }` });
const { orchestrateResearch } = await bundled('server/researchOrchestrator.js', {
  '/webSearch.js': `export const identifySubject = () => ({name:'Example',orgType:'generic',domain:'example.com'}); export const getWebResearchStatus = () => 'test'; export const researchSubject = async () => ({results:[{}], queriesRun:1, errors:['One search failed']});`,
  '/evidenceExtraction.js': `export const extractEvidenceFromCrawl = async () => ({sourcesCreated:1,evidenceCreated:2,errors:[]}); export const extractEvidenceFromSearch = async () => ({sourcesCreated:1,evidenceCreated:1,errors:[]});`,
  '/claimEngine.js': `export const generateClaimsFromEvidence = async () => ({claimsCreated:2,errors:[]}); export const removeDuplicateClaims = async () => ({removed:0,errors:[]}); export const detectClaimConflicts = async () => [];`,
});

function setup(tables, fail) {
  globalThis.__backendDb = database(tables, fail);
  globalThis.__backendMocks = { claims: [{ id: randomUUID(), claim: 'Example provides workflow tools for growing teams.' }], analyzeWebsite: async () => ({ analysis: { title: 'Example', pages: [] }, audit: {}, understanding: {} }) };
  return globalThis.__backendDb;
}

test('repeated research keeps evidence and generation scoped to the newest run', async () => {
  const db = setup({ sources: [], evidence: [], claims: [], research_sessions: [
    { id: 'old', project_id: projectId, status: 'partial', created_at: '2026-01-01' },
    { id: 'new', project_id: projectId, status: 'partial', created_at: '2026-01-02' },
  ] });
  for (const session of ['old', 'new']) {
    const text = session === 'old' ? 'Example provides the obsolete service for teams.' : 'Example provides the current service for teams.';
    const result = await extractEvidenceFromCrawl(projectId, { url: 'https://example.com', paragraphs: [text] }, [{ url: 'https://example.com', paragraphs: [text] }], session);
    assert.deepEqual(result.errors, []);
    assert.equal(result.evidenceCreated, 1);
    db.rows.claims.push({ id: randomUUID(), project_id: projectId, research_session_id: session, claim: text, status: 'supported', confidence: 0.8 });
  }
  assert.equal(db.rows.sources.length, 2);
  assert.equal(db.rows.evidence.length, 2);
  assert.equal((await realGetClaims(projectId))[0].claim, 'Example provides the current service for teams.');
  db.rows.research_sessions[1].status = 'failed';
  assert.deepEqual(await realGetClaims(projectId), []);
});

test('private images reject anonymous and unrelated users while the owner can load them', async () => {
  const db = setup({ project_visibility: [{ project_id: projectId, visibility: 'private' }] });
  let downloads = 0;
  db.storage = { from: () => ({ download: async () => { downloads++; return { data: new Blob(['image'], { type: 'image/png' }), error: null }; } }) };
  const query = { projectId, path: `${projectId}/main.png` };
  assert.equal((await request(assetHandler, 'GET', {}, query, '')).code, 404);
  assert.equal((await request(assetHandler, 'GET', {}, query, 'someone-else')).code, 404);
  assert.equal(downloads, 0);
  const result = await request(assetHandler, 'GET', {}, query);
  assert.equal(result.code, 200);
  assert.equal(downloads, 1);
  assert.match(result.headers['Cache-Control'], /no-store/);
});
async function request(handler, method, body, query = {}, token = 'owner-token') {
  const res = { code: 200, data: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; }, end() { return this; } };
  await handler({ method, body, query, headers: { authorization: token ? `Bearer ${token}` : '' } }, res);
  return res;
}

test('all deployed auth entry points import and support OPTIONS without runtime credentials', async () => {
  for (const name of ['signup', 'confirm-email']) {
    const { default: handler } = await import(`../api/auth/${name}.js`);
    assert.equal((await request(handler, 'OPTIONS')).code, 204);
  }
});

test('router handles nested auth aliases, rejects extra segments and malformed JSON', async () => {
  const invoke = async (url, body, method = 'OPTIONS') => {
    const res = { code: 0, data: null, setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; }, end() {} };
    await router({ url, method, body, headers: {} }, res);
    return res;
  };
  assert.equal((await invoke('/api/auth/signup')).code, 204);
  assert.equal((await invoke('/api/projects/unknown')).code, 404);
  assert.equal((await invoke('/api/projects', '{bad', 'POST')).code, 400);
  assert.equal((await invoke('/api/projects', 'null', 'POST')).code, 400);
  assert.equal((await invoke('/api/health', undefined, 'GET')).data.ok, true);
});

test('visibility fails closed when database permission lookup fails', async () => {
  const db = setup({}, q => q.table === 'project_visibility' ? { message: 'Database down' } : null);
  await assert.rejects(ensureDeckAccess(db, { headers: {} }, projectId), error => error.message === 'Database down');
});

test('private deck is owner-only; missing visibility retains link-only behavior', async () => {
  const db = setup({ project_visibility: [{ project_id: projectId, visibility: 'private' }] });
  assert.equal((await ensureDeckAccess(db, { headers: {} }, projectId)).allowed, false);
  assert.equal((await ensureDeckAccess(db, { headers: { authorization: 'Bearer other-token' } }, projectId)).allowed, false);
  assert.equal((await ensureDeckAccess(db, { headers: { authorization: 'Bearer owner-token' } }, projectId)).allowed, true);
  db.rows.project_visibility = [];
  assert.equal(await getVisibility(db, projectId), 'unlisted');
});

test('workspace chat is not exposed through a public or unlisted presentation link', async () => {
  setup();
  assert.equal((await request(chatHandler, 'GET', undefined, { projectId }, '')).code, 403);
  assert.equal((await request(chatHandler, 'GET', undefined, { projectId })).code, 200);
});

test('pipeline compare-and-set gives only one concurrent caller the lease', async () => {
  const db = setup();
  const original = structuredClone(db.rows.projects[0]);
  const results = await Promise.all([claimPipeline(db, original, 'crawling'), claimPipeline(db, original, 'crawling')]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('pipeline lease can recover after a terminated request', async () => {
  const db = setup();
  db.rows.projects[0].status = 'researching';
  assert.equal(await claimPipeline(db, db.rows.projects[0], 'crawling'), false);
  db.rows.projects[0].updated_at = new Date(Date.now() - 10 * 60_000).toISOString();
  assert.equal(await claimPipeline(db, structuredClone(db.rows.projects[0]), 'crawling'), true);
});

test('regeneration with no claims preserves the current slides, spec and generated status', async () => {
  const db = setup();
  globalThis.__backendMocks.claims = [];
  const before = structuredClone(db.rows.slides);
  const res = await request(generateHandler, 'POST', { projectId });
  assert.equal(res.code, 422);
  assert.equal(res.data.error, 'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(db.rows.slides, before);
  assert.equal(db.rows.projects[0].status, 'generated');
  assert.ok(!db.calls.some(q => q.table === 'slides' && q.operation === 'delete'));
});

test('regeneration planner failure and database commit failure both preserve the old deck', async () => {
  for (const mode of ['planner', 'commit']) {
    const db = setup({}, q => mode === 'commit' && q.operation === 'rpc' ? { message: 'Write failed', code: '23514' } : null);
    globalThis.__backendMocks.planError = mode === 'planner';
    const before = structuredClone(db.rows.slides);
    const res = await request(generateHandler, 'POST', { projectId });
    assert.equal(res.code, 500);
    assert.deepEqual(db.rows.slides, before);
    assert.equal(db.rows.projects[0].status, 'generated');
  }
});

test('regeneration commits slides and canonical presentation together', async () => {
  const db = setup();
  const res = await request(generateHandler, 'POST', { projectId });
  assert.equal(res.code, 200);
  assert.equal(db.rows.slides[0].title, 'Replacement title');
  assert.equal(db.rows.project_specs[0].spec.slides[0].id, db.rows.slides[0].id);
  assert.equal(db.rows.projects[0].status, 'generated');
  assert.ok(db.calls.some(q => q.table === 'save_project_deck' && q.operation === 'rpc'));
});

test('AI regeneration uses research claims and preserves the selected purpose', async () => {
  const db = setup();
  globalThis.__backendMocks.claims = [];
  await assert.rejects(executeRealOps(db, projectId, [{ op: 'regenerate' }]), /No verified claims/);
  assert.equal(db.rows.slides[0].title, 'Original title');
  globalThis.__backendMocks.claims = [{ claim: 'Example workflow tools' }];
  await executeRealOps(db, projectId, [{ op: 'regenerate' }]);
  assert.equal(db.rows.project_specs[0].spec.meta.purpose, 'investor_research');
  assert.equal(db.rows.slides[0].title, 'Replacement title');
});

test('a rejected generation request cannot reset another running pipeline', async () => {
  const db = setup();
  db.rows.projects[0].status = 'researching';
  assert.equal((await request(generateHandler, 'POST', { projectId })).code, 409);
  assert.equal(db.rows.projects[0].status, 'researching');
  assert.equal((await request(generateHandler, 'POST', { projectId }, {}, '')).code, 403);
  assert.equal(db.rows.projects[0].status, 'researching');
});

test('analysis persistence failure releases running status so the user can retry', async () => {
  const db = setup();
  db.rows.projects[0].status = 'queued';
  assert.equal((await request(analyzeHandler, 'POST', { projectId })).code, 500);
  assert.equal(db.rows.projects[0].status, 'failed');
});

test('create, update, reorder and delete slide endpoints synchronize the stored spec before returning', async () => {
  const db = setup();
  let res = await request(slidesHandler, 'PUT', { id: slideId, title: 'Edited title' });
  assert.equal(res.code, 200);
  assert.equal(db.rows.project_specs[0].spec.slides[0].elements.find(e => e.content.role === 'title').content.text, 'Edited title');
  res = await request(slidesHandler, 'POST', { project_id: projectId, type: 'custom', title: 'New slide', bullets: [], stats: [] });
  assert.equal(res.code, 201);
  const addedId = res.data.id;
  assert.equal(db.rows.project_specs[0].spec.slides.length, 2);
  res = await request(slidesHandler, 'PUT', { reorder: [{ id: slideId, sort_order: 20 }, { id: addedId, sort_order: 10 }] });
  assert.equal(res.code, 200);
  assert.equal(db.rows.slides.find(s => s.id === addedId).sort_order, 10);
  assert.equal((await request(slidesHandler, 'DELETE', { id: addedId })).code, 200);
  assert.equal(db.rows.project_specs[0].spec.slides.length, 1);
  assert.equal((await request(slidesHandler, 'DELETE', { id: slideId })).code, 200);
  assert.equal(db.rows.project_specs.length, 0);
});

test('manual presentation save uses a single transaction and preserves citation provenance', async () => {
  const db = setup();
  db.rows.slides[0].claim_ids = [randomUUID()];
  db.rows.slides[0].source_urls = ['https://example.com/source'];
  const spec = buildSpecFromSlides(project(), [slide()], 'generated');
  const res = await request(specHandler, 'PUT', { projectId, spec });
  assert.equal(res.code, 200);
  assert.equal(res.data.version, 1);
  assert.deepEqual(db.rows.slides[0].source_urls, ['https://example.com/source']);
  assert.equal(db.calls.filter(q => q.operation === 'rpc').length, 1);
  assert.ok(!db.calls.some(q => ['slides', 'project_specs'].includes(q.table) && ['insert', 'update', 'delete'].includes(q.operation)));
});

test('failed presentation transaction leaves both slide rows and the canonical spec untouched', async () => {
  const db = setup({}, q => q.operation === 'rpc' ? { message: 'Transaction failed', code: '23514' } : null);
  const spec = buildSpecFromSlides(project(), [slide()], 'generated');
  const before = structuredClone(db.rows);
  assert.equal((await request(specHandler, 'PUT', { projectId, spec })).code, 500);
  assert.deepEqual(db.rows, before);
});

test('theme updates change the canonical theme while retaining edited element positions', async () => {
  const spec = buildSpecFromSlides(project(), [slide()], 'generated');
  spec.slides[0].elements[0].position = { mode: 'absolute', x: 111, y: 222, z: 1 };
  const db = setup({ project_specs: [{ project_id: projectId, spec, version: 4 }] });
  assert.equal((await request(themeHandler, 'PUT', { projectId, theme: { accent: '#ff0000', skin: 'dark' } })).code, 200);
  assert.equal(db.rows.project_specs[0].spec.theme.colors.accent, '#ff0000');
  assert.equal(db.rows.project_specs[0].spec.slides[0].elements[0].position.x, 111);
  assert.equal(db.rows.project_specs[0].version, 5);
});

test('legacy content edits preserve custom positions, extra elements, backgrounds and canonical theme', async () => {
  const spec = buildSpecFromSlides(project(), [slide()], 'generated');
  const title = spec.slides[0].elements.find(el => el.content.role === 'title');
  title.position = { mode: 'absolute', x: 130, y: 160, z: 1 };
  spec.slides[0].background = { type: 'solid', value: '#123456' };
  spec.theme.colors.accent = '#987654';
  const extra = { ...structuredClone(title), id: randomUUID(), content: { ...title.content, text: 'Extra designer text', role: 'caption' } };
  spec.slides[0].elements.push(extra);
  const db = setup({ project_specs: [{ project_id: projectId, spec, version: 2 }] });
  assert.equal((await request(slidesHandler, 'PUT', { id: slideId, title: 'Updated headline' })).code, 200);
  const saved = db.rows.project_specs[0].spec;
  assert.equal(saved.slides[0].elements.find(el => el.id === title.id).content.text, 'Updated headline');
  assert.equal(saved.slides[0].elements.find(el => el.id === title.id).position.x, 130);
  assert.equal(saved.slides[0].elements.find(el => el.id === extra.id).content.text, 'Extra designer text');
  assert.equal(saved.slides[0].background.value, '#123456');
  assert.equal(saved.theme.colors.accent, '#987654');
});

test('presentation database failures are returned as errors rather than empty successful decks', async () => {
  setup({}, q => q.table === 'slides' ? { message: 'Database down' } : null);
  assert.equal((await request(presentationHandler, 'GET', undefined, { projectId })).code, 500);
});

test('claim conflict detection keeps independent metrics and distinguishes decimal values', () => {
  assert.equal(areContradictory('Example serves 100 cities worldwide', 'Example serves 500 users worldwide'), false);
  assert.equal(areContradictory('Example serves 100 cities worldwide', 'Example serves 200 cities worldwide'), true);
  assert.equal(areContradictory('Example has 1,000 customers worldwide', 'Example has 1000 customers worldwide'), false);
  assert.equal(areContradictory('Example has 1.5 million users', 'Example has 15 million users'), true);
});

test('research creates a separate session per run and reports its effective search mode and errors', async () => {
  const db = setup();
  const first = await orchestrateResearch(projectId, project(), { analysis: { pages: [] } });
  const second = await orchestrateResearch(projectId, project(), { analysis: { pages: [] } });
  assert.equal(db.rows.research_sessions.length, 2);
  assert.equal(first.researchMode, 'crawl_and_search');
  assert.equal(second.researchMode, 'crawl_and_search');
  for (const session of db.rows.research_sessions) {
    assert.equal(session.status, 'completed');
    assert.equal(session.errors_count, 1);
    assert.equal(session.research_mode, 'crawl_and_search');
  }
});

test('missing research schema is a visible failure instead of a successful empty study', async () => {
  setup({}, q => q.table === 'research_sessions' ? { message: 'Missing relation', code: '42P01' } : null);
  await assert.rejects(orchestrateResearch(projectId, project(), { analysis: {} }), error => error.code === '42P01');
});

test('project deletion keeps slides and chat intact if storage cleanup fails', async () => {
  const db = setup({ assets: [{ project_id: projectId, path: 'image.jpg' }] });
  db.storage = { from: () => ({ remove: async () => ({ error: { message: 'Storage unavailable' } }) }) };
  const before = structuredClone(db.rows);
  assert.equal((await request(projectsHandler, 'DELETE', { id: projectId })).code, 500);
  assert.deepEqual(db.rows, before);
});

test('optimized image dimensions match saved bytes and invalid crops fail visibly', async () => {
  const { default: sharp } = await import('sharp');
  const input = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#336699' } }).png().toBuffer();
  const result = await optimizeImage(input);
  const metadata = await sharp(result.main).metadata();
  assert.equal(result.width, 1920);
  assert.equal(result.height, 960);
  assert.equal(result.width, metadata.width);
  await assert.rejects(optimizeImage(input, { crop: { x: 1990, y: 990, w: 50, h: 50 } }), /Crop region/);
});

test('export readiness returns a blocking report for invalid documents', async () => {
  const report = await buildReadinessReport(null, { probeAssets: false });
  assert.equal(report.ready, false);
  assert.ok(report.counts.block > 0);
});

test('PowerPoint readiness accepts supported icons', async () => {
  const spec = buildSpecFromSlides(project(), [slide()], 'generated');
  const icon = structuredClone(spec.slides[0].elements[0]);
  icon.id = randomUUID(); icon.type = 'icon'; icon.content = { kind: 'icon', name: 'star', pack: 'lucide' };
  spec.slides[0].elements.push(icon);
  const report = await buildReadinessReport(spec, { format: 'pptx', probeAssets: false });
  assert.equal(report.ready, true);
  assert.equal(report.findings.some(f => f.severity === 'block' && f.message.includes('icon export')), false);
});

test('export image redirects cannot bypass private-network protection', async context => {
  const visited = [];
  context.mock.method(globalThis, 'fetch', async url => {
    visited.push(url);
    return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } });
  });
  await assert.rejects(fetchExportImage('https://example.com/image'), /Private target blocked/);
  assert.equal(visited.length, 1);
});

test('export image downloads cancel an oversized streaming response', async context => {
  let cancelled = false;
  context.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(80)); },
    cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'image/png' } }));
  await assert.rejects(fetchExportImage('https://example.com/image', { maxBytes: 100 }), /size limit/);
  assert.equal(cancelled, true);
});
