import {
  generateVisualBrief,
  searchAndRankVisuals,
  scoreCandidateVisual,
  decideSlideVisual,
  CURATED_VISUAL_CATALOG,
} from '../server/visualSearch.js';
import { generateSlides, applyCommand } from '../server/engine.js';
import { slideToSpec } from '../.test-build/deckspec.mjs';

// ---------------------------------------------------------------- Visual Brief Generator Tests

t('visual brief: constructs narrative brief for healthcare SaaS', () => {
  const slide = {
    title: 'Transforming clinical care with AI',
    subtitle: 'Real-time diagnostic assistance for physicians',
    body: 'Clinicians review patient metrics and automated scans with superhuman speed.',
  };
  const understanding = { category: 'Healthcare AI' };
  const visualDna = { personality: 'editorial', primary: '#0284C7' };

  const brief = generateVisualBrief(slide, understanding, visualDna);
  assert.ok(brief.keywords.includes('clinical') || brief.keywords.includes('health'), 'Extracted clinical domain keywords');
  assert.ok(brief.briefText.includes('editorial') || brief.briefText.includes('magazine'), 'Included editorial aesthetic brief');
  assert.notEqual(brief.query, slide.title, 'Generated narrative brief instead of raw slide title');
});

t('visual brief: constructs narrative brief for developer platform', () => {
  const slide = {
    title: 'Instant serverless deployment',
    subtitle: 'Deploy backend microservices in seconds',
    body: 'Automate build pipelines and scale edge functions globally.',
  };
  const understanding = { category: 'Developer Tool' };
  const visualDna = { personality: 'technical', primary: '#10B981' };

  const brief = generateVisualBrief(slide, understanding, visualDna);
  assert.ok(brief.keywords.includes('developer') || brief.keywords.includes('code'), 'Extracted developer domain keywords');
  assert.ok(brief.briefText.includes('engineering') || brief.briefText.includes('terminal'), 'Included technical style brief');
});

// ---------------------------------------------------------------- Visual Ranking & Harmony Tests

t('visual ranking: scores candidate by semantic relevance & color harmony', () => {
  const brief = {
    query: 'cloud infrastructure technology',
    briefText: 'cloud, server, datacenter, engineering',
    keywords: ['cloud', 'server', 'infrastructure'],
    category: 'technology',
    personality: 'technical',
  };
  const visualDna = { primary: '#0F172A', isDark: true };

  const candidate = CURATED_VISUAL_CATALOG.find((c) => c.id === 'tech-cloud-infra');
  assert.ok(candidate, 'Found cloud candidate');

  const score = scoreCandidateVisual(candidate, brief, visualDna, new Set());
  assert.ok(score >= 0.7, `Expected high match score >= 0.7, got ${score}`);
});

t('visual ranking: enforces deck deduplication', () => {
  const brief = {
    query: 'cloud infrastructure technology',
    briefText: 'cloud, server, datacenter',
    keywords: ['cloud', 'server'],
    category: 'technology',
    personality: 'technical',
  };
  const visualDna = { primary: '#0F172A', isDark: true };
  const candidate = CURATED_VISUAL_CATALOG[0];

  const used = new Set([candidate.url]);
  const score = scoreCandidateVisual(candidate, brief, visualDna, used);
  assert.equal(score, -1, 'Used candidate rejected with -1 score');
});

t('visual search: returns top-ranked visual with complete attribution metadata', () => {
  const brief = {
    query: 'data metrics analytics',
    briefText: 'analytics, data, metrics, dashboard',
    keywords: ['analytics', 'metrics', 'dashboard'],
    category: 'technology',
    personality: 'refined',
  };
  const visualDna = { primary: '#10B981', isDark: false };

  const ranked = searchAndRankVisuals(brief, visualDna);
  assert.ok(ranked.url.startsWith('https://'), 'Valid image URL');
  assert.ok(ranked.attribution.provider, 'Has attribution provider');
  assert.ok(ranked.attribution.author, 'Has author attribution');
  assert.ok(ranked.attribution.license, 'Has license info');
  assert.ok(ranked.aspectRatio, 'Has aspect ratio');
});

// ---------------------------------------------------------------- Slide Visual Decision & Restraint Tests

t('visual decision: anchors hero with website screenshot and preserves restraint for data slides', () => {
  const project = {
    url: 'https://linear.app',
    analysis: {
      host: 'linear.app',
      screenshot: 'https://linear.app/screenshot.png',
      images: [],
    },
    understanding: {
      productName: 'Linear',
      category: 'Productivity',
      tagline: 'Issue tracking with superhuman speed.',
    },
  };
  const visualDna = { primary: '#5E6AD2', isDark: true };
  const used = new Set();

  // 1. Hero slide receives screenshot
  const heroDecision = decideSlideVisual({ type: 'hero' }, project, visualDna, used);
  assert.equal(heroDecision.type, 'screenshot');
  assert.equal(heroDecision.placement, 'browser');
  assert.equal(heroDecision.url, 'https://linear.app/screenshot.png');

  // 2. Metrics & Workflow slides maintain restraint (no distracting images)
  const workflowDecision = decideSlideVisual({ type: 'workflow' }, project, visualDna, used);
  assert.equal(workflowDecision.type, 'none');

  const benefitsDecision = decideSlideVisual({ type: 'benefits' }, project, visualDna, used);
  assert.equal(benefitsDecision.type, 'none');
});

// ---------------------------------------------------------------- SlideSpec Bridge Tests

t('spec bridge: embeds visualDecision metadata and card frame into SlideSpec', () => {
  const slide = {
    id: 's-bridge-1',
    sort_order: 10,
    type: 'solution',
    title: 'The Linear way',
    subtitle: 'Purpose-built for speed',
    body: 'Linear re-imagines issue tracking.',
    bullets: ['Superhuman speed — instant interactions'],
    stats: [],
    image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
    visualDecision: {
      type: 'external-image',
      placement: 'card',
      attribution: { provider: 'Unsplash', author: 'Luke Chesser' },
    },
    layout: 'split',
    animation: 'fade',
  };

  const spec = slideToSpec(slide, 0);
  const imgEl = spec.elements.find((el) => el.type === 'image');
  assert.ok(imgEl, 'Image element created in SlideSpec');
  assert.equal(imgEl.content.kind, 'image');
  assert.equal(imgEl.content.frame, 'plain');
  assert.equal(imgEl.metadata?.visualDecisionType, 'external-image');
});


// ---------------------------------------------------------------- AI Creative Director Visual Commands Tests

t('visual commands: handles "remove stock images" and "more photography"', () => {
  const project = {
    id: 'p-vis-1',
    url: 'https://acme.inc',
    analysis: { host: 'acme.inc' },
    understanding: { productName: 'Acme', category: 'Software' },
  };

  const slides = [
    {
      id: 's1',
      sort_order: 10,
      type: 'hero',
      title: 'Acme Platform',
      image_url: 'https://acme.inc/shot.png',
      visualDecision: { type: 'screenshot' },
      layout: 'split',
    },
    {
      id: 's2',
      sort_order: 20,
      type: 'solution',
      title: 'The Solution',
      image_url: 'https://images.unsplash.com/photo-stock',
      visualDecision: { type: 'external-image' },
      layout: 'split',
    },
  ];

  // Command 1: Remove stock images
  const res1 = applyCommand(project, slides, 'Use only images from my website');
  assert.ok(res1.ops.length > 0, 'Produced ops for website-only images');
  const s2Update = res1.ops.find((o) => o.id === 's2');
  assert.ok(s2Update, 'Slide 2 updated');
  assert.equal(s2Update.fields.image_url, '', 'External image cleared');
  assert.equal(s2Update.fields.visualDecision.type, 'none');

  // Command 2: Refresh image on solution
  const res2 = applyCommand(project, slides, 'Replace the image on solution');
  assert.ok(res2.ops.some((o) => o.id === 's2'), 'Refreshed image on solution slide');
});
