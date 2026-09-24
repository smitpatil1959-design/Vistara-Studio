import { buildVistaraDNA } from '../server/dnaEngine.js';

const mockX = {
  title: 'Linear — Purpose-built tool for modern product teams',
  meta: {
    description: 'Linear is a purpose-built tool for modern software teams to manage projects, tasks, and roadmaps with high-velocity execution.',
    'og:site_name': 'Linear',
    'og:image': 'https://linear.app/static/og.png',
  },
  headings: [
    { level: 1, text: 'Issue tracking you will actually enjoy using' },
    { level: 2, text: 'Streamlined Cycles and Workflows' },
    { level: 2, text: 'Roadmaps and Project Milestones' },
    { level: 2, text: 'Instant Sync & Keyboard-First Speed' },
  ],
  paragraphs: [
    'Linear helps streamline software projects, sprints, tasks, and bug tracking. Built for high-performance product organizations.',
    'Engineered for speed, with zero latency and instant optimistic updates.',
  ],
  buttons: ['Start using Linear', 'Book a Demo', 'Read Documentation'],
  colors: [
    { hex: '#5e6ad2', count: 48 },
    { hex: '#0f1015', count: 85 },
    { hex: '#ffffff', count: 120 },
  ],
  fonts: ['Inter', 'Space Grotesk'],
  images: [
    { src: 'https://linear.app/static/logo.svg', alt: 'Linear Logo' },
    { src: 'https://linear.app/static/screenshot.png', alt: 'Linear Board View' },
  ],
  links: [
    { url: 'https://linear.app/features', internal: true },
    { url: 'https://linear.app/pricing', internal: true },
  ],
  forms: { inputs: 1, labeled: 1 },
  ariaCount: 12,
  mediaQueries: 4,
};

t('dna: synthesizes complete 7-pillar Vistara DNA with verified citations', () => {
  const dna = buildVistaraDNA({
    x: mockX,
    subX: [],
    host: 'linear.app',
    pages: [{ path: '/', title: mockX.title, words: 350, status: 200 }],
    probed: [{ url: 'https://linear.app/features', status: 200, ok: true }],
    visualDna: { accent: '#5e6ad2', accent2: '#8b5cf6', skin: 'dark', radius: 14, headingFont: 'Space Grotesk', bodyFont: 'Inter' },
    understanding: {
      productName: 'Linear',
      tagline: 'Purpose-built tool for modern product teams',
      category: 'Project Management & Developer Tools',
      summary: 'Linear streamlines software projects, sprints, and task tracking.',
      features: [
        { name: 'Cycles', desc: 'Automated sprint tracking' },
        { name: 'Roadmaps', desc: 'Visual project roadmaps' },
      ],
      differentiators: ['Sub-50ms interaction latency', 'Keyboard-first workflow shortcuts'],
      usps: ['Blazing speed with optimistic UI', 'Deep Git & GitHub integration'],
    },
    targetUrl: 'https://linear.app',
  });

  // Verify core pillars existence
  assert.ok(dna.brandIdentity, 'brandIdentity pillar exists');
  assert.ok(dna.businessUnderstanding, 'businessUnderstanding pillar exists');
  assert.ok(dna.audience, 'audience pillar exists');
  assert.ok(dna.brandVoice, 'brandVoice pillar exists');
  assert.ok(dna.visualLanguage, 'visualLanguage pillar exists');
  assert.ok(dna.experienceIntelligence, 'experienceIntelligence pillar exists');
  assert.ok(dna.verificationSummary, 'verificationSummary exists');

  // Verify Brand Identity
  assert.equal(dna.brandIdentity.logo.status, 'Verified');
  assert.equal(dna.brandIdentity.logo.url, 'https://linear.app/static/logo.svg');
  assert.equal(dna.brandIdentity.colorPalette.status, 'Verified');
  assert.equal(dna.brandIdentity.typography.headingFont, 'Space Grotesk');

  // Verify Business Understanding
  assert.equal(dna.businessUnderstanding.productName, 'Linear');
  assert.equal(dna.businessUnderstanding.summary.status, 'Verified');
  assert.ok(dna.businessUnderstanding.productsServices.length >= 2, 'Products & services extracted');
  assert.ok(dna.businessUnderstanding.differentiators.length >= 2, 'Differentiators extracted');

  // Verify Audience & Brand Voice
  assert.equal(dna.audience.primaryAudience.status, 'Verified');
  assert.equal(dna.brandVoice.ctaStyle.primaryAction, 'Start using Linear');

  // Verify Experience Intelligence
  assert.equal(dna.experienceIntelligence.userJourney.status, 'Verified');
  assert.ok(dna.experienceIntelligence.strengths.length > 0, 'Strengths detected');

  // Verify Verification Summary
  assert.ok(dna.verificationSummary.overallScore >= 80, 'Overall verification score is high');
  assert.ok(dna.verificationSummary.verifiedCount >= 5, 'Verified count is substantial');
  assert.ok(dna.verificationSummary.totalEvidencePoints >= 10, 'Total evidence points are recorded');
});

t('dna: handles missing or sparse data gracefully without hallucinations', () => {
  const sparseX = {
    title: '',
    meta: {},
    headings: [],
    paragraphs: [],
    buttons: [],
    colors: [],
    fonts: [],
    images: [],
    links: [],
  };

  const dna = buildVistaraDNA({
    x: sparseX,
    subX: [],
    host: 'example.com',
    pages: [],
    probed: [],
    visualDna: null,
    understanding: null,
    targetUrl: 'https://example.com',
  });

  assert.equal(dna.brandIdentity.logo.status, 'Not verified');
  assert.equal(dna.brandIdentity.logo.url, null);
  assert.equal(dna.brandIdentity.colorPalette.status, 'Not verified');
  assert.ok(dna.verificationSummary.notVerifiedCount > 0, 'Unverified points are honestly counted');
});
