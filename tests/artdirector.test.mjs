import {
  extractVisualDna,
  generatePresentationDesignSystem,
  generateSlides,
  validateAndRepairDeck,
  relativeLuminance,
  contrastRatio,
  tintHex,
  shadeHex,
  applyCommand,
} from '../server/engine.js';

// ---------------------------------------------------------------- Visual DNA & Color Harmony Tests

t('color: relative luminance and contrast ratio calculation', () => {
  const whiteLum = relativeLuminance('#FFFFFF');
  const blackLum = relativeLuminance('#000000');
  assert.equal(Math.round(whiteLum), 1);
  assert.equal(Math.round(blackLum), 0);

  const ratio = contrastRatio('#FFFFFF', '#000000');
  assert.ok(ratio >= 20, `Expected maximum contrast ratio ~21:1, got ${ratio}`);
});

t('art director: green-heavy website produces bespoke emerald design system', () => {
  const greenX = {
    title: 'Linear — Purpose-built product management',
    description: 'Linear streamlines software projects, sprints, tasks, and bug tracking.',
    headings: [
      { level: 1, text: 'Linear is a better way to build products' },
      { level: 2, text: 'Issue tracking with superhuman speed' },
      { level: 2, text: 'Sync cycles and roadmaps in real-time' },
    ],
    colors: [{ hex: '#10B981', count: 12 }, { hex: '#059669', count: 8 }],
    fonts: ['Inter Tight', 'Inter'],
  };

  const dna = extractVisualDna(greenX, [], 'linear.app', {
    visualDna: {
      bodyBg: '#FFFFFF',
      bodyColor: '#111827',
      isDark: false,
      btnBg: '#10B981',
      btnColor: '#FFFFFF',
      cardRadius: 16,
    },
  });

  assert.equal(dna.primary, '#10b981');
  const ds = generatePresentationDesignSystem(dna);

  assert.ok(ds.colors.bg.startsWith('#'), 'Valid background color');
  assert.ok(ds.colors.accent === '#10b981' || ds.colors.accent === '#10B981', 'Emerald accent preserved');
  assert.ok(ds.colors.surfaceAlt.length >= 7, 'Harmonious surfaceAlt generated');
  assert.ok(contrastRatio(ds.colors.text, ds.colors.bg) >= 4.5, 'Meets WCAG AA text contrast on background');
});

t('art director: red/dark website produces bespoke ruby & obsidian design system', () => {
  const redDarkX = {
    title: 'Datadog — Cloud monitoring and security platform',
    description: 'See metrics, traces, and logs across your entire cloud stack in one pane of glass.',
    headings: [
      { level: 1, text: 'Modern monitoring & security' },
      { level: 2, text: 'Real-time observability' },
      { level: 2, text: 'Instant incident triage' },
    ],
    colors: [{ hex: '#F43F5E', count: 14 }, { hex: '#DC2626', count: 6 }],
    fonts: ['Space Grotesk', 'Inter'],
  };

  const dna = extractVisualDna(redDarkX, [], 'datadoghq.com', {
    visualDna: {
      bodyBg: '#0C0A09',
      bodyColor: '#FAFAF9',
      isDark: true,
      btnBg: '#F43F5E',
      btnColor: '#FFFFFF',
      cardRadius: 8,
    },
  });

  assert.equal(dna.isDark, true);
  assert.equal(dna.primary, '#f43f5e');

  const ds = generatePresentationDesignSystem(dna);
  assert.equal(ds.skin, 'dark');
  assert.ok(contrastRatio(ds.colors.text, ds.colors.bg) >= 4.5, 'Meets WCAG AA text contrast on dark background');
  assert.ok(contrastRatio(ds.colors.text, ds.colors.surface) >= 4.5, 'Meets WCAG AA text contrast on dark surface');
});

t('art director: minimal black/white website produces crisp monochrome system', () => {
  const monoX = {
    title: 'Vercel — The platform for frontend developers',
    description: 'Deploy web projects with the best frontend developer experience and global CDN.',
    headings: [
      { level: 1, text: 'Develop. Preview. Ship.' },
      { level: 2, text: 'Next.js on global edge' },
      { level: 2, text: 'Zero-config serverless deployments' },
    ],
    colors: [{ hex: '#000000', count: 20 }, { hex: '#FFFFFF', count: 18 }],
    fonts: ['Inter', 'Geist'],
  };

  const dna = extractVisualDna(monoX, [], 'vercel.com', {
    visualDna: {
      bodyBg: '#FFFFFF',
      bodyColor: '#000000',
      isDark: false,
      btnBg: '#000000',
      btnColor: '#FFFFFF',
      cardRadius: 10,
    },
  });

  const ds = generatePresentationDesignSystem(dna);
  assert.ok(ds.colors.bg, 'Has background token');
  assert.ok(ds.colors.surface, 'Has surface token');
  assert.ok(contrastRatio(ds.colors.text, ds.colors.bg) >= 4.5, 'Meets WCAG AA contrast');
});

// ---------------------------------------------------------------- Slide Generation & Narrative Composition

t('slide composition: generates 11 bespoke sections with distinct layouts', () => {
  const project = {
    id: 'proj-test-1',
    name: 'Acme Studio',
    url: 'https://acme.studio',
    analysis: {
      host: 'acme.studio',
      pages: [{ url: 'https://acme.studio', title: 'Acme' }],
      tech: [{ name: 'React', category: 'Framework' }, { name: 'Tailwind CSS', category: 'Styling' }],
      screenshot: 'https://acme.studio/shot.png',
      loadMs: 140,
      sizeKb: 42,
    },
    audit: { overall: 94 },
    understanding: {
      productName: 'Acme',
      category: 'Creative Tool',
      tagline: 'Craft high-converting presentations in minutes.',
      summary: 'Acme transforms website signals into boardroom-ready presentation decks with AI art direction.',
      audience: ['designers', 'founders'],
      businessGoal: 'accelerate presentation workflows for modern teams',
      features: [
        { name: 'Live scan', desc: 'Reads website signals in real-time.' },
        { name: 'Visual DNA', desc: 'Extracts brand typography and colors.' },
        { name: 'Story arcs', desc: 'Composes purpose-driven narratives.' },
      ],
      benefits: [{ title: 'Velocity', desc: '10x faster deck turnaround.', metric: '10x' }],
      usps: ['Zero generic templates', 'Bespoke color harmony'],
      technology: ['React', 'Tailwind CSS', 'Chromium'],
      tone: 'refined',
    },
  };

  const slides = generateSlides(project, 'general');
  assert.equal(slides.length, 11, 'Generates full 11-section narrative arc');

  // Verify diverse layouts across slides
  const layouts = new Set(slides.map((s) => s.layout));
  assert.ok(layouts.size >= 3, `Expected at least 3 distinct layout types, got ${layouts.size}`);

  // Verify all slides have non-empty titles and valid sort orders
  slides.forEach((s, i) => {
    assert.ok(s.title && s.title.length > 0, `Slide ${i} has non-empty title`);
    assert.ok(s.sort_order > 0, `Slide ${i} has positive sort order`);
  });
});

// ---------------------------------------------------------------- Quality Check & Auto-Repair Gate

t('quality check: auto-repairs excessive lengths and duplicate titles', () => {
  const rawSlides = [
    {
      type: 'hero',
      title: 'This is an excessively long presentation title that should be tightened by the quality gate to prevent text overflow on canvas',
      subtitle: 'This is an excessively long subtitle that goes on and on and explains far too many redundant details that should be trimmed to safe length',
      body: 'This is an excessively long body paragraph that contains way too much text and needs to be capped and condensed so that it never clips outside of the 16:9 safe margins.',
      bullets: [
        'A very long bullet heading — with an extremely long bullet explanation that goes on and on and repeats itself without adding any value',
      ],
      stats: [{ value: '99.999999% uptime guaranteed', label: 'Extremely long stat label that should fit within 36 characters max' }],
      layout: 'left',
    },
    {
      type: 'intro',
      title: 'This is an excessively long presentation title that should be tightened by the quality gate to prevent text overflow on canvas',
      subtitle: 'Short subtitle',
      body: 'Short body',
      bullets: [],
      stats: [],
      layout: 'left',
    },
    {
      type: 'problem',
      title: 'Third section',
      subtitle: 'Subtitle',
      body: 'Body',
      bullets: [],
      stats: [],
      layout: 'left', // 3rd consecutive 'left' layout
    },
  ];

  const repaired = validateAndRepairDeck(rawSlides);

  // Length caps
  assert.ok(repaired[0].title.length <= 75, `Title length capped: ${repaired[0].title.length}`);
  assert.ok(repaired[0].subtitle.length <= 125, `Subtitle length capped: ${repaired[0].subtitle.length}`);
  assert.ok(repaired[0].body.length <= 205, `Body length capped: ${repaired[0].body.length}`);

  // Duplicate title deduplication
  assert.ok(repaired[1].title.includes('(Cont.)'), 'Duplicate title flagged with (Cont.)');

  // Anti-collision layout adjustment
  assert.notEqual(repaired[2].layout, 'left', 'Anti-collision altered 3rd consecutive identical layout');
});

// ---------------------------------------------------------------- AI Creative Director Commands

t('creative director: handles high-level art direction prompts', () => {
  const project = {
    id: 'proj-cmd-1',
    theme: { skin: 'light', accent: '#65A30D', accent2: '#1A2E05', headingFont: 'Inter Tight' },
    understanding: { productName: 'Acme', category: 'Software' },
    analysis: {},
    audit: { overall: 90 },
  };
  const slides = [
    { id: 's1', sort_order: 10, type: 'hero', title: 'Acme *Platform*', animation: 'fade' },
    { id: 's2', sort_order: 20, type: 'intro', title: 'Meet *Acme*', animation: 'fade' },
  ];

  // Prompt 1: Luxury editorial styling
  const res1 = applyCommand(project, slides, 'Make this presentation more luxurious with dark backgrounds and champagne accents');
  assert.ok(res1.ops.length > 0, 'Produced ops for luxury command');
  const themeUpdate = res1.ops.find((o) => o.op === 'updateProject')?.fields?.theme;
  assert.ok(themeUpdate, 'Updated project theme');
  assert.equal(themeUpdate.skin, 'dark', 'Skin shifted to dark');
  assert.equal(themeUpdate.headingFont, 'Instrument Serif', 'Heading font shifted to Instrument Serif');

  // Prompt 2: Cinematic motion
  const res2 = applyCommand(project, slides, 'Make the transitions more cinematic');
  assert.ok(res2.ops.some((o) => o.op === 'updateProject' || o.op === 'updateSlide'), 'Produced cinematic motion ops');
});
