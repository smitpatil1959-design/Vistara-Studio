import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import JSZip from 'jszip';
mkdirSync('.test-build/backend', { recursive: true });
await build({ entryPoints: ['src/deck-spec/index.ts'], outfile: '.test-build/backend/v2-spec.mjs', bundle: true, format: 'esm', platform: 'node' });
const engine = await import(pathToFileURL(resolve('.test-build/backend/v2-spec.mjs')).href);
const document = () => engine.buildSpecFromSlides({ id: 'p', name: 'Example', url: 'https://example.com', theme: {} }, [{ id: crypto.randomUUID(), sort_order: 1, type: 'hero', title: 'Example connects teams', bullets: [], stats: [] }], 'generated');

test('the expanded story accepts only supplied passages and intact financial comparisons', async () => {
  const { assembleEvidenceStory, readReportedComparison, collectStoryPassages } = await import('../server/presentation/evidenceStory.js');
  const source = 'https://example.com/results';
  const comparison = 'Consolidated revenue grew from INR 15,227 crore in FY25 to INR 23,053 crore in FY26.';
  assert.deepEqual(readReportedComparison(comparison, source, 'claim').series.map(point => [point.label, point.value]), [['FY25', 15227], ['FY26', 23053]]);
  assert.equal(readReportedComparison(comparison.replace('23,053 crore', '23,053 million'), source, 'claim'), null);
  assert.equal(readReportedComparison('Projected: ' + comparison, source, 'claim'), null);
  assert.equal(readReportedComparison('Revenue from operations was ₹23,053 crore in FY2025–26, compared with ₹15,227 crore in FY2024–25.', source, 'claim').series[0].value, 23053);
  assert.equal(readReportedComparison('Revenue was ₹23,053 crore in FY26, compared with net income of ₹15,227 crore in FY25.', source, 'claim'), null);
  const japanese = 'この大学では学生と研究者が地域の環境問題に取り組んでいます。';
  assert.equal(collectStoryPassages([{ id: 'jp', claim: japanese, source_urls: [source], status: 'verified', confidence: 0.9 }], 'ja')[0].text, japanese);
  const passages = ['The public report describes the founding mission.', 'The documented initiative launched in several cities.', 'The public report lists current software products.', 'The documented initiative expanded delivery to stores.', 'The public report describes service fees and commissions.', 'The documented initiative includes membership subscriptions.'].map((text, i) => ({ claim: { id: String(i) }, source, text }));
  const sections = ['profile', 'offerings', 'model'].map((topic, i) => ({ topic, items: [{ ref: i * 2, label: 'public report' }, { ref: i * 2 + 1, label: 'documented initiative' }] }));
  const slides = assembleEvidenceStory({ sections }, passages, { url: source }, { name: 'Example' });
  assert.equal(slides.length, 4);
  assert.equal(slides[1].source_urls[0], source);
  sections[0].items[1].label = 'invented outcome';
  assert.deepEqual(assembleEvidenceStory({ sections }, passages, { url: source }, { name: 'Example' }), []);
});

test('a product photo with a logo in its description is distinct from a logo asset', async () => {
  const { getImages } = await import('../server/engine.js');
  const images = getImages('<img src="/images/device.jpg" alt="Pink phone with a white logo on the back"><img src="/assets/mark.png" alt="Example logo">', 'https://example.com/');
  assert.equal(images[0].isLogo, false);
  assert.equal(images[1].isLogo, true);
});

test('AI previews retain current evidence and reject unsupported metrics or targets', async () => {
  const { validateProposalOps } = await import('../server/editorProposal.js');
  const doc = document(), slide = doc.slides[0], title = slide.elements.find(el => el.content.role === 'title');
  const claims = [
    { id: 'a', status: 'verified', claim: 'The project enrolled 20 students.', confidence: 0.9, source_urls: ['https://example.com/a'] },
    { id: 'b', status: 'verified', claim: 'The program enrolled 40 students.', confidence: 0.9, source_urls: ['https://example.com/b'] },
  ];
  const ops = validateProposalOps([
    { kind: 'rewrite', elementId: title.id, text: 'Example connects 100 teams' },
    { kind: 'rewrite', elementId: 'unrelated', text: 'New text' },
    { kind: 'chart', claimIds: ['a', 'unverified'] },
    { kind: 'chart', claimIds: ['a', 'b'] },
  ], slide, claims);
  assert.equal(ops.length, 1);
  assert.deepEqual(ops[0].points.map(point => point.value), [20, 40]);
  const result = engine.applyEditorProposal(doc, { slideId: slide.id, operations: ops });
  assert.equal(doc.slides.length, 1);
  assert.equal(result.document.slides.length, 2);
  assert.equal(result.document.slides[1].sources[1].url, 'https://example.com/b');
  assert.equal(engine.validatePresentation(result.document).valid, true);
});

test('a specific product URL excludes unrelated same-domain sources when relevant evidence is available', async () => {
  const { claimsForPresentation } = await import('../server/presentationPlanner.js');
  const product = Array.from({ length: 7 }, (_, index) => ({ id: index, source_urls: [index === 6 ? 'https://example.com/device-pro/' : 'https://example.com/device/'] }));
  const unrelated = { id: 9, source_urls: ['https://www.example.com/laptop/'] };
  assert.deepEqual(claimsForPresentation([unrelated, ...product], 'https://www.example.com/device/'), product);
  assert.equal(claimsForPresentation([unrelated, ...product], 'https://www.example.com/').length, 8);
});

test('V2 PowerPoint contains native text, chart, table and diagram objects with presenter notes', async () => {
  const { buildPptx } = await import('../server/export/pptx.js');
  const doc = engine.designPresentation(document(), engine.brandForLegacy('Example', 'https://example.com', '#FF5200'));
  const slide = doc.slides[0];
  slide.notes = 'Review the real figures.';
  slide.sources = [{ url: 'https://example.com/source' }];
  slide.background = { type: 'gradient', value: 'linear-gradient(135deg, #FF5200, #102021)' };
  const title = slide.elements.find(el => el.content.role === 'title');
  title.rotation = 15;
  const chart = engine.makeElement('chart');
  chart.content.chart = 'donut'; chart.content.series = [{ label: 'A', value: 7 }, { label: 'B', value: 9 }];
  const table = engine.makeElement('table');
  const diagram = engine.makeElement('diagram'); diagram.content.edges.push({ from: diagram.content.nodes[0].id, to: diagram.content.nodes[1].id });
  slide.elements.push(chart, table, diagram);
  const pptx = await buildPptx(doc);
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
  const content = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(content, /Example connects teams/);
  assert.match(content, /rot="900000"/);
  assert.match(content, /<a:tbl>/);
  assert.match(content, /First step/);
  assert.match(await zip.file('ppt/charts/chart1.xml').async('string'), /<c:doughnutChart>/);
  const notes = await zip.file('ppt/notesSlides/notesSlide1.xml').async('string');
  assert.match(notes, /Review the real figures/);
  assert.match(notes, /https:\/\/example\.com\/source/);
});

test('v2 migration preserves old IDs, manual styles, nested transforms, notes and sources', () => {
  const old = document(); old.schemaVersion = 'presentation.v1';
  const slide = old.slides[0], id = slide.elements[0].id;
  slide.notes = 'Presenter notes'; slide.sources = [{ url: 'https://example.com/about' }];
  slide.elements[0].rotation = 27; slide.elements[0].locked = true;
  slide.elements[0].style.fontFamily = 'Georgia';
  const migrated = engine.normalizePresentation(old, { theme: engine.defaultThemeSpec(), motion: engine.defaultMotionSpec() });
  assert.equal(migrated.schemaVersion, 'presentation.v2');
  assert.equal(migrated.meta.migratedFrom, 'presentation.v1');
  assert.equal(migrated.slides[0].elements[0].id, id);
  assert.equal(migrated.slides[0].elements[0].rotation, 27);
  assert.equal(migrated.slides[0].elements[0].locked, true);
  assert.equal(migrated.slides[0].elements[0].style.fontFamily, 'Georgia');
  assert.equal(migrated.slides[0].notes, 'Presenter notes');
  assert.equal(migrated.slides[0].sources.length, 1);
  assert.equal(engine.validatePresentation(old).valid, true);
  assert.equal(engine.validatePresentation(migrated).valid, true);
});

test('recursive duplication mints unique IDs without modifying the original group', () => {
  const doc = document(), slide = doc.slides[0];
  const group = engine.makeElement('group');
  group.content.children = [engine.makeElement('text'), engine.makeElement('shape')];
  slide.elements.push(group);
  const { spec: copied } = engine.duplicateSlide(doc, slide.id);
  const all = copied.slides.flatMap(s => s.elements.flatMap(e => [e.id, ...(e.content.kind === 'group' ? e.content.children.map(child => child.id) : [])]));
  assert.equal(new Set(all).size, all.length);
  assert.equal(doc.slides.length, 1);
  assert.equal(engine.validatePresentation(copied).valid, true);
});

test('charts never start with invented data and invalid data is rejected', () => {
  const chart = engine.makeElement('chart');
  assert.deepEqual(chart.content.series, []);
  const doc = document(); doc.slides[0].elements.push(chart);
  chart.content.series = [{ label: 'Not a number', value: NaN }];
  assert.equal(engine.validatePresentation(doc).valid, false);
});

test('duplicate element IDs and invalid table cells cannot be saved', () => {
  const doc = document(); doc.slides[0].elements.push(structuredClone(doc.slides[0].elements[0]));
  assert.equal(engine.validatePresentation(doc).valid, false);
  const clean = document(), table = engine.makeElement('table');
  table.content.rows = [[{ unsafe: true }]]; clean.slides[0].elements.push(table);
  assert.equal(engine.validatePresentation(clean).valid, false);
});

test('brand detection prioritizes real CSS and CTA signals over neutral page colours', () => {
  const sourceUrl = 'https://example.com';
  const kit = engine.deriveBrandKit({ name: 'Example', url: sourceUrl, signals: [
    { value: '#FFFFFF', role: 'background', sourceUrl, method: 'body', confidence: 1 },
    { value: '#111111', role: 'cta', sourceUrl, method: 'neutral utility button', confidence: 0.8 },
    { value: '#FF6600', role: 'css-primary', sourceUrl, method: '--brand-primary', confidence: 0.95 },
    { value: '#00AB77', role: 'navigation', sourceUrl, method: 'nav text', confidence: 0.7 },
  ] });
  assert.equal(kit.primaryColor, '#FF6600'); assert.equal(kit.isFallback, false);
  assert.ok(kit.sources.some(signal => signal.method === '--brand-primary'));
  for (const mood of ['brand', 'editorial', 'contrast', 'soft']) {
    const theme = engine.themeFromBrand(kit, mood);
    assert.ok(engine.contrast(theme.colors.text, theme.colors.bg) >= 4.5);
    assert.ok(engine.contrast(theme.colors.muted, theme.colors.bg) >= 4.5);
  }
});

test('missing branding is labelled as a fallback and malformed colours never enter the kit', () => {
  const kit = engine.deriveBrandKit({ name: 'Plain site', url: 'https://example.com', signals: [
    { value: 'javascript:bad', role: 'css-primary', sourceUrl: 'https://example.com', method: 'invalid', confidence: 1 },
  ] });
  assert.equal(kit.isFallback, true); assert.equal(kit.confidence, 0);
  assert.deepEqual(kit.sources, []);
  assert.match(kit.primaryColor, /^#[A-F0-9]{6}$/);
});

test('the composition catalogue preserves real content and produces bounded, contrasting slides', () => {
  const doc = document(), slide = doc.slides[0];
  slide.sources = [{ url: 'https://example.com/evidence' }];
  for (let i = 0; i < 4; i++) {
    const card = engine.makeElement('card'); card.content.title = `Supported capability ${i + 1}`;
    card.content.body = 'The source describes this capability for its users.'; slide.elements.push(card);
  }
  assert.equal(engine.COMPOSITIONS.length, 31);
  const brand = engine.brandForLegacy('Example', 'https://example.com', '#FF6600');
  for (const preset of engine.COMPOSITIONS) {
    const next = engine.composeSlide(slide, engine.themeFromBrand(brand), preset.id, 1, 6, brand);
    const repaired = engine.repairDesign({ ...doc, slides: [next] });
    assert.equal(engine.validatePresentation(repaired).valid, true, preset.id);
    assert.equal(engine.inspectDesign(repaired).filter(issue => issue.kind === 'overflow' || issue.kind === 'contrast').length, 0, preset.id);
    assert.equal(next.sources[0].url, 'https://example.com/evidence');
    assert.equal(next.elements.find(el => el.content.kind === 'text' && el.content.role === 'title').content.text, 'Example connects teams');
    assert.equal(next.elements.some(el => el.content.kind === 'chart' && el.content.series.length), false);
  }
});

test('source-led overview and strategy layouts retain every card without overlapping', () => {
  const doc = document(), slide = doc.slides[0];
  const brand = engine.brandForLegacy('Example', 'https://example.com', '#FF5200');
  slide.metadata.storyComposition = 'overview';
  const cards = Array.from({ length: 4 }, (_, index) => {
    const card = engine.makeElement('card');
    card.position = { mode: 'flow', slot: 'card' };
    card.content.title = `Evidence item ${index + 1}`;
    card.content.body = 'The report explains the details of this initiative and its purpose.';
    return card;
  });
  slide.elements.push(...cards);
  const theme = engine.themeFromBrand(brand);
  const overview = engine.composeSlide(slide, theme, 'overview', 1, 4, brand);
  const strategy = engine.composeSlide(slide, theme, 'summary', 2, 4, brand);
  for (const result of [overview, strategy]) {
    assert.ok(cards.every(card => result.elements.some(element => element.id === card.id)));
    assert.equal(engine.inspectDesign({ ...doc, theme, slides: [result] }).length, 0);
  }
  assert.ok(overview.elements.find(element => element.id === cards[0].id).size.h > overview.elements.find(element => element.id === cards[1].id).size.h);
});

test('brand-aware design varies backgrounds, keeps citations and preserves manual geometry on recolour', () => {
  const doc = document();
  for (let i = 1; i < 6; i++) { const slide = structuredClone(doc.slides[0]); slide.id = crypto.randomUUID(); slide.section = i === 5 ? 'cta' : i % 2 ? 'features' : 'overview'; doc.slides.push(slide); }
  const designed = engine.designPresentation(doc, engine.brandForLegacy('Example', 'https://example.com', '#E85D21'));
  assert.ok(new Set(designed.slides.map(slide => slide.background.value)).size >= 4);
  const before = structuredClone(designed.slides[0].elements[1].position);
  const themed = engine.applyTheme(designed, engine.themeFromBrand({ ...designed.brand, primaryColor: '#1E995A' }));
  assert.deepEqual(themed.slides[0].elements[1].position, before);
  assert.notEqual(themed.slides[0].background.value, designed.slides[0].background.value);
});

test('group, move, resize, rotate and ungroup retain editable world geometry', () => {
  const doc = document(), slide = doc.slides[0];
  const a = engine.makeElement('shape'), b = engine.makeElement('text');
  a.position = { mode: 'absolute', x: 100, y: 100 }; a.size = { w: 100, h: 100 };
  b.position = { mode: 'absolute', x: 260, y: 100 }; b.size = { w: 200, h: 100 };
  slide.elements = [a, b];
  const grouped = engine.groupSelection(doc, slide.id, [a.id, b.id]);
  assert.ok(grouped.id); assert.equal(grouped.spec.slides[0].elements.length, 1);
  const moved = engine.moveSelection(grouped.spec, slide.id, [grouped.id], 50, 80);
  const flattened = engine.flattenElements(moved.slides[0].elements);
  assert.equal(flattened[0].position.x, 150); assert.equal(flattened[1].position.y, 180);
  const rotated = engine.rotateSelection(moved, slide.id, [grouped.id], 90);
  const ungrouped = engine.ungroupSelection(rotated, slide.id, [grouped.id]);
  assert.equal(ungrouped.ids.length, 2);
  assert.equal(ungrouped.spec.slides[0].elements[0].rotation, 90);
  assert.equal(engine.validatePresentation(ungrouped.spec).valid, true);
  const resized = engine.resizeSelection(grouped.spec, slide.id, [grouped.id], { x: 100, y: 100, w: 720, h: 200 });
  assert.equal(resized.slides[0].elements[0].content.children[0].size.w, 200);
  assert.equal(doc.slides[0].elements.length, 2);
});

test('locked elements stay unchanged and snapping finds canvas and peer alignment', () => {
  const doc = document(), slide = doc.slides[0], el = slide.elements[0];
  el.locked = true; const before = structuredClone(el);
  assert.deepEqual(engine.moveSelection(doc, slide.id, [el.id], 100, 100).slides[0].elements[0], before);
  const snap = engine.snapPosition({ x: 539, y: 120, w: 200, h: 100 }, [], { width: 1280, height: 720 }, 6);
  assert.equal(snap.x, 540); assert.ok(snap.guides.some(guide => guide.value === 640));
});
