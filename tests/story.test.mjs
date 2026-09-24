import { generateSlides, validateAndRepairDeck } from '../server/engine.js';

// ---------------------------------------------------------------- Story vs Audit Content Tests

t('story engine: generates pure product story with zero audit telemetry', () => {
  const project = {
    id: 'p-linear-1',
    name: 'Linear',
    url: 'https://linear.app',
    analysis: {
      host: 'linear.app',
      pages: [
        { url: 'https://linear.app', title: 'Linear' },
        { url: 'https://linear.app/features', title: 'Features' },
        { url: 'https://linear.app/docs', title: 'Docs' },
      ],
      tech: [{ name: 'React', category: 'Framework' }, { name: 'Tailwind CSS', category: 'Styling' }],
      screenshot: 'https://linear.app/screenshot.png',
      loadMs: 140,
      sizeKb: 42,
    },
    audit: {
      overall: 95,
      categories: [],
      vitals: { lcpMs: 820 },
    },
    understanding: {
      productName: 'Linear',
      category: 'Productivity Platform',
      tagline: 'Linear is a better way to build products. Meet the new standard for modern software development.',
      summary: 'Linear streamlines software projects, sprints, tasks, and bug tracking with superhuman speed and craft.',
      audience: ['software engineers', 'product managers', 'designers'],
      businessGoal: 'accelerate product execution for high-performance software teams',
      features: [
        { name: 'Cycles', desc: 'Automate sprint planning and focus on what matters.' },
        { name: 'Roadmaps', desc: 'Set quarterly goals and track real-time project progress.' },
        { name: 'Insights', desc: 'Understand team velocity and export actionable metrics.' },
      ],
      benefits: [
        { title: 'Superhuman speed', desc: 'Zero lag interactions designed for keyboard-first flow.', metric: '50ms' },
        { title: 'Streamlined cycles', desc: 'Cut planning overhead in half.', metric: '2x' },
      ],
      usps: ['Purpose-built for modern product teams', 'Keyboard-first navigation', 'Real-time sync engine'],
      technology: ['React', 'TypeScript', 'Tailwind CSS'],
      tone: 'refined',
      host: 'linear.app',
    },
  };

  const slides = generateSlides(project, 'general');
  assert.equal(slides.length, 11, 'Generates full 11-section narrative');

  // Verify that NO slide contains audit score, load time, page count, or document weight
  const FORBIDDEN_WORDS = [
    'audit score',
    'composite audit',
    'measured audit',
    'pages analyzed',
    'pages in the experience',
    'pages in production',
    'pages shipped',
    'response time',
    'first response',
    'document weight',
    'measured document weight',
    'audit verdict',
    'measured health',
  ];

  for (const [idx, slide] of slides.entries()) {
    // Check titles and subtitles
    const textBlob = `${slide.title} ${slide.subtitle} ${slide.body} ${(slide.bullets || []).join(' ')} ${(slide.stats || []).map((s) => `${s.value} ${s.label}`).join(' ')}`.toLowerCase();

    for (const forbidden of FORBIDDEN_WORDS) {
      assert.ok(
        !textBlob.includes(forbidden),
        `Slide ${idx + 1} (${slide.type}) must not contain forbidden audit term "${forbidden}". Found in: "${textBlob}"`
      );
    }

    // Check stats labels and values
    for (const stat of slide.stats || []) {
      assert.ok(!/95\/100|140\s?ms|42\s?kb/i.test(stat.value), `Stat value "${stat.value}" on slide ${slide.type} must not be crawl telemetry`);
    }

    // Check bullets for robotic metadata prefixes
    for (const bullet of slide.bullets || []) {
      assert.ok(!/^Goal —/i.test(bullet), `Bullet on slide ${slide.type} must not start with robotic "Goal —"`);
      assert.ok(!/^Tone —/i.test(bullet), `Bullet on slide ${slide.type} must not start with robotic "Tone —"`);
      assert.ok(!/^Language —/i.test(bullet), `Bullet on slide ${slide.type} must not start with robotic "Language —"`);
    }
  }
});

t('story engine: validateAndRepairDeck cleans telemetry from malformed slides', () => {
  const malformed = [
    {
      type: 'hero',
      title: 'Acme *Platform*',
      subtitle: 'Modern platform',
      body: 'Overview of the experience',
      bullets: ['Goal — build products', 'Tone — formal', 'Language — en'],
      stats: [
        { value: '98/100', label: 'Audit score' },
        { value: '120 ms', label: 'Response time' },
        { value: 'Modern', label: 'Platform category' },
      ],
      layout: 'left',
    },
  ];

  const repaired = validateAndRepairDeck(malformed);
  assert.equal(repaired[0].stats.length, 1, 'Stripped 2 audit telemetry stats');
  assert.equal(repaired[0].stats[0].label, 'Platform category');
  assert.ok(repaired[0].bullets[0].startsWith('Mission —'), 'Rewrote robotic Goal — to Mission —');
});
