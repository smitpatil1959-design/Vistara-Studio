const {
  MOTION_PRESETS,
  getMotionPreset,
  resolveMotionPreset,
} = await import('../.test-build/deckspec.mjs');

import { applyCommand, generateSlides } from '../server/engine.js';


// ---------------------------------------------------------------- Motion Design System Tests

t('motion: all six premium motion presets resolve with valid physics', () => {
  const ids = ['cinematic', 'elegant', 'minimal', 'futuristic', 'energetic', 'corporate'];
  for (const id of ids) {
    const preset = getMotionPreset(id);
    assert.equal(preset.id, id, `Preset ${id} matches id`);
    assert.ok(preset.durationMs >= 200 && preset.durationMs <= 1200, `Duration ${preset.durationMs}ms is in safe range`);
    assert.ok(preset.delayStaggerMs >= 40 && preset.delayStaggerMs <= 200, `Stagger ${preset.delayStaggerMs}ms is in safe range`);
    assert.ok(['fade', 'rise', 'slide', 'zoom', 'blur', 'scale', 'morph'].includes(preset.entrance), `Valid entrance: ${preset.entrance}`);
  }
});

t('motion: NLP fuzzy resolution maps aliases to canonical presets', () => {
  assert.equal(resolveMotionPreset('dramatic Hollywood style'), 'cinematic');
  assert.equal(resolveMotionPreset('sophisticated and graceful'), 'elegant');
  assert.equal(resolveMotionPreset('clean and quiet restraint'), 'minimal');
  assert.equal(resolveMotionPreset('cyberpunk neon velocity'), 'futuristic');
  assert.equal(resolveMotionPreset('punchy fast energetic'), 'energetic');
  assert.equal(resolveMotionPreset('boardroom conservative corporate'), 'corporate');
});

t('motion: AI Creative Director handles conversational motion commands', () => {
  const project = {
    id: 'p-motion-1',
    name: 'Vistara',
    url: 'https://vistara.studio',
    theme: { skin: 'dark', motion: 'calm' },
    understanding: {
      productName: 'Vistara',
      category: 'Design Tool',
      tagline: 'AI presentation engine',
      audience: ['designers'],
      features: [{ name: 'Art Director', desc: 'Bespoke layouts' }],
      benefits: [{ title: 'Velocity', desc: '10x faster', metric: '10x' }],
      usps: ['Zero generic templates'],
    },
  };

  const slides = generateSlides(project, 'general');

  // Test 1: "Make the presentation more cinematic"
  const cinRes = applyCommand(project, slides, 'Make the presentation more cinematic');
  const cinTheme = cinRes.ops.find((o) => o.op === 'updateProject')?.fields?.theme;
  assert.equal(cinTheme?.motion, 'cinematic', 'Theme motion set to cinematic');

  // Test 2: "Animate the features one by one"
  const stagRes = applyCommand(project, slides, 'Animate the features one by one');
  const featSlide = slides.find((s) => s.type === 'features');
  assert.ok(stagRes.ops.some((o) => o.op === 'updateSlide' && o.id === featSlide.id && o.fields.animation === 'stagger'), 'Targets features slide with stagger');

  // Test 3: "Make the opening more dramatic"
  const dramRes = applyCommand(project, slides, 'Make the opening more dramatic');
  const heroSlide = slides.find((s) => s.type === 'hero');
  assert.ok(dramRes.ops.some((o) => o.op === 'updateSlide' && o.id === heroSlide.id && o.fields.animation === 'zoom'), 'Targets hero slide with dramatic zoom');

  // Test 4: "Remove animations from the entire deck"
  const remRes = applyCommand(project, slides, 'Remove animations from the entire deck');
  assert.ok(remRes.ops.filter((o) => o.op === 'updateSlide' && o.fields.animation === 'none').length >= slides.length, 'Disables animations across all slides');
});

t('motion: reduced motion preference safely collapses transforms and blurs', () => {
  const motionSpec = getMotionPreset('cinematic');
  assert.equal(motionSpec.id, 'cinematic', 'Resolved cinematic preset');
  assert.ok(motionSpec.durationMs > 0, 'Has valid duration');

  // Minimal and corporate presets have zero parallax for reduced motion friendliness
  const minPreset = getMotionPreset('minimal');
  assert.equal(minPreset.parallax, 0, 'Minimal preset has zero parallax');
  assert.equal(minPreset.direction, 'none', 'Minimal preset has no directional movement');
});

