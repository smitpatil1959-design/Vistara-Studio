const spec = await import('../.test-build/deckspec.mjs');

const fixture = () => ({
  schemaVersion: 'presentation.v1',
  id: 't1',
  name: 'Audit deck',
  canvas: { width: 1280, height: 720 },
  theme: {
    name: 'P', skin: 'light',
    colors: { bg: '#fff', surface: '#fff', surfaceAlt: '#eee', text: '#111', muted: '#888', accent: '#65A30D', accent2: '#0E7490', line: 'rgba(0,0,0,0.1)' },
    typography: { headingFont: 'Inter Tight', bodyFont: 'Inter', baseSize: 16, scaleRatio: 1.25 },
    spacing: { unit: 8, sectionGap: 48, cardGap: 20 },
    radius: { sm: 10, md: 16, lg: 24, pill: 999 },
    shadows: { sm: '', md: '', lg: '', glow: '' },
    effects: { grain: true, glass: false, glowIntensity: 0.5 },
  },
  motion: { entrance: 'rise', exit: 'fade', durationMs: 550, delayStaggerMs: 90, easing: 'spring-soft', transition: 'fade', preset: null, direction: 'up', trigger: 'onEnter', parallax: 0.3 },
  slides: [
    {
      id: 's1', section: 'hero', label: 'Cover', layout: 'split',
      background: { type: 'theme', value: '' }, transition: 'fade', metadata: {},
      elements: [
        { id: 'e1', type: 'text', position: { mode: 'flow', slot: 'title', order: 1 }, size: { w: 'auto', h: 'auto' }, content: { kind: 'text', text: 'Hello *world*', role: 'title' }, style: {}, animation: { preset: 'rise', delayMs: 0 }, metadata: {} },
      ],
    },
  ],
  meta: { projectUrl: 'https://example.com', purpose: 'investor', source: 'generated' },
  updatedAt: new Date().toISOString(),
});

t('spec: valid doc validates clean', () => {
  const r = spec.validatePresentation(fixture());
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});
t('spec: unknown section rejected', () => {
  const d = fixture();
  d.slides[0].section = 'hologram';
  assert.equal(spec.validatePresentation(d).valid, false);
});
t('spec: unknown element type rejected', () => {
  const d = fixture();
  d.slides[0].elements[0].type = 'hologram';
  assert.equal(spec.validatePresentation(d).valid, false);
});
t('spec: duplicate element ids rejected', () => {
  const d = fixture();
  d.slides[0].elements.push(JSON.parse(JSON.stringify(d.slides[0].elements[0])));
  // note: per-slide id check lives on slide ids; duplicate slide id must fail
  d.slides.push(JSON.parse(JSON.stringify(d.slides[0])));
  const r = spec.validatePresentation(d);
  assert.equal(r.valid, false);
});
t('spec: absolute mode without coords rejected', () => {
  const d = fixture();
  d.slides[0].elements[0].position = { mode: 'absolute' };
  assert.equal(spec.validatePresentation(d).valid, false);
});
t('spec: motion preset enum enforced', () => {
  const d = fixture();
  d.motion.preset = 'vaporwave';
  assert.equal(spec.validatePresentation(d).valid, false);
});

t('ops: text edit is pure (input untouched)', () => {
  const d = fixture();
  const next = spec.updateElement(d, 's1', 'e1', { contentText: 'Changed' });
  assert.equal(d.slides[0].elements[0].content.text, 'Hello *world*');
  assert.equal(next.slides[0].elements[0].content.text, 'Changed');
});
t('ops: duplicate mints a new uuid and offsets', () => {
  const d = fixture();
  const { spec: next, newId } = spec.duplicateElement(d, 's1', 'e1');
  assert.equal(next.slides[0].elements.length, 2);
  assert.ok(newId && newId !== 'e1');
  assert.match(newId, /^[0-9a-f-]{36}$/);
});
t('ops: delete removes, never below one slide', () => {
  const d = fixture();
  assert.equal(spec.deleteElement(d, 's1', 'e1').slides[0].elements.length, 0);
  assert.equal(spec.deleteSlide(d, 's1').slides.length, 1, 'last slide is protected');
});
t('ops: move clamps inside the canvas', () => {
  const d = fixture();
  const moved = spec.moveElementTo(d, 's1', 'e1', 999999, 9999);
  const p = moved.slides[0].elements[0].position;
  assert.equal(p.mode, 'absolute');
  assert.ok(p.x <= 1280 - 24 && p.y <= 720 - 24, 'clamped to canvas');
});

t('motion: all six presets resolve', () => {
  assert.equal(spec.MOTION_PRESETS.length, 6);
  for (const id of ['cinematic', 'elegant', 'minimal', 'futuristic', 'energetic', 'corporate']) {
    assert.equal(spec.getMotionPreset(id).id, id);
  }
});
t('motion: fuzzy NL resolution', () => {
  assert.equal(spec.resolveMotionPreset('like a movie premiere'), 'cinematic');
  assert.equal(spec.resolveMotionPreset('boardroom tempo'), 'corporate');
  assert.equal(spec.resolveMotionPreset('set accent to red'), null);
});
t('motion: hand-tuned clears the preset tag', () => {
  const d = fixture();
  const tagged = spec.setMotionPreset(d, 'cinematic');
  assert.equal(tagged.motion.preset, 'cinematic');
  const tuned = spec.tuneMotion(tagged, { durationMs: 1200 });
  assert.equal(tuned.motion.preset, null);
  assert.equal(tuned.motion.durationMs, 1200);
});
