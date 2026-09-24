import { analyzeSlideQuality, analyzeDeckQuality, critiqueAndRepairDeck } from '../server/qualityEngine.js';
import { generateSlides } from '../server/engine.js';

// ---------------------------------------------------------------- Quality Engine Tests

t('quality engine: slide quality analysis detects prohibited audit telemetry', () => {
  const malformedSlide = {
    id: 's-bad-1',
    type: 'intro',
    title: 'Audit Overview',
    subtitle: 'Live report',
    body: 'We recorded an Audit score of 98/100 across 12 pages analyzed with a 240ms response time.',
    bullets: ['Performance score — 99%', 'Security score — 100%'],
    stats: [{ value: '98/100', label: 'Health score' }],
    layout: 'left',
  };

  const analysis = analyzeSlideQuality(malformedSlide);
  assert.equal(analysis.passed, false, 'Fails quality gate due to audit telemetry');
  assert.ok(analysis.issues.some((i) => i.message.includes('prohibited technical audit telemetry')), 'Flags prohibited telemetry');
  assert.ok(analysis.scores.content < 60, 'Penalizes content score heavily');
});

t('quality engine: slide quality analysis validates clean story-driven slide', () => {
  const goodSlide = {
    id: 's-good-1',
    type: 'solution',
    title: 'The *Unified* Platform',
    subtitle: 'One seamless workspace for modern design teams',
    body: 'Vistara brings clarity and momentum to presentation creation with an intelligent art director.',
    bullets: ['Instant Art Direction — Bespoke typography and color harmony', 'Zero Overlap — 16:9 canvas bounding-box validation'],
    stats: [{ value: '10x', label: 'Velocity increase' }],
    layout: 'split',
    image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
    visualDecision: { type: 'external-image', reason: 'Editorial mockup' },
  };

  const designSystem = { skin: 'dark', bg: '#080E0B', text: '#F0FDF4', accent: '#10B981' };
  const analysis = analyzeSlideQuality(goodSlide, designSystem);

  assert.equal(analysis.passed, true, 'Clean slide passes quality gate');
  assert.ok(analysis.scores.overall >= 90, 'Scores in high 90s');
  assert.equal(analysis.issues.length, 0, 'Zero issues on well-crafted slide');
});

t('quality engine: deck-level analysis evaluates narrative arc and story progression', () => {
  const project = {
    id: 'p-story-1',
    name: 'Linear',
    url: 'https://linear.app',
    analysis: { host: 'linear.app', pages: [] },
    understanding: {
      productName: 'Linear',
      category: 'Project Management',
      tagline: 'The issue tracker you will actually enjoy using.',
      summary: 'Linear streamlines software projects, sprints, and roadmaps with speed.',
      audience: ['engineers', 'founders'],
      businessGoal: 'accelerate product execution',
      features: [{ name: 'Cycles', desc: 'Automated sprint tracking' }],
      benefits: [{ title: 'Speed', desc: 'Zero latency UI', metric: '60fps' }],
      usps: ['Blazing fast keyboard-first workflow'],
    },
  };

  const slides = generateSlides(project, 'general');
  const deckQuality = analyzeDeckQuality(slides, project);

  assert.equal(deckQuality.passed, true, 'Generated story deck passes quality evaluation');
  assert.ok(deckQuality.overallScore >= 88, 'Deck overall score is >= 88');
  assert.equal(deckQuality.story.hasNarrativeArc, true, 'Deck covers complete narrative arc');
  assert.ok(deckQuality.scores.story >= 85, 'Story score is high');
});

t('quality engine: detects and auto-repairs repetitive visual rhythm', () => {
  const monotonousSlides = [
    { id: 's1', type: 'hero', title: 'Hero Slide', layout: 'grid', bullets: [] },
    { id: 's2', type: 'intro', title: 'Intro Slide', layout: 'grid', bullets: [] },
    { id: 's3', type: 'problem', title: 'Problem Slide', layout: 'grid', bullets: [] },
    { id: 's4', type: 'solution', title: 'Solution Slide', layout: 'grid', bullets: [] },
    { id: 's5', type: 'cta', title: 'Closing Slide', layout: 'center', bullets: [] },
  ];

  // Analyze un-repaired deck
  const preAnalysis = analyzeDeckQuality(monotonousSlides);
  assert.ok(preAnalysis.rhythm.repetitivePatterns.length > 0, 'Detects 3 consecutive grid slides');

  // Auto-repair deck
  const repairResult = critiqueAndRepairDeck(monotonousSlides);
  assert.equal(repairResult.summary.passed, true, 'Repaired deck passes quality check');
  assert.equal(repairResult.quality.rhythm.repetitivePatterns.length, 0, 'Repairs and eliminates repetitive layout rhythm');

  // Verify consecutive grid layouts were reflowed
  const layouts = repairResult.slides.map((s) => s.layout);
  assert.notEqual(layouts[2], layouts[1] && layouts[0], 'Layouts now alternate rhythmically');
});

t('quality engine: bounded critique loop deduplicates duplicate headlines', () => {
  const duplicateSlides = [
    { id: 's1', type: 'features', title: 'Core Capabilities', layout: 'grid', bullets: ['A — B'] },
    { id: 's2', type: 'features', title: 'Core Capabilities', layout: 'split', bullets: ['C — D'] },
  ];

  const repairResult = critiqueAndRepairDeck(duplicateSlides);
  const titles = repairResult.slides.map((s) => s.title);
  assert.notEqual(titles[0], titles[1], 'Deduplicates identical slide headlines');
  assert.ok(titles[1].includes('Part II') || titles[1].includes('Cont'), 'Adds narrative continuation tag');
});
