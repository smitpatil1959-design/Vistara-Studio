import { applyCommand, generateSlides } from '../server/engine.js';
import { directorTurn } from '../server/aiDirector.js';

// ---------------------------------------------------------------- AI Creative Director Tests

t('creative director: handles ✦ AI Redesign command', () => {
  const project = {
    id: 'p-redesign-1',
    name: 'Vistara',
    url: 'https://vistara.studio',
    analysis: {
      host: 'vistara.studio',
      visualDna: {
        dominantColor: '#059669',
        secondaryColor: '#10B981',
        isDark: true,
        personality: 'refined',
        h1Font: 'Instrument Serif',
      },
      pages: [],
      tech: [],
    },
    theme: { skin: 'dark', accent: '#3b82f6', headingFont: 'Inter' },
    understanding: {
      productName: 'Vistara',
      category: 'Design Platform',
      tagline: 'Next-generation presentation engine.',
      audience: ['designers', 'founders'],
      businessGoal: 'create bespoke decks instantly',
      features: [{ name: 'Art Director', desc: 'Designs bespoke presentations' }],
      benefits: [{ title: 'Velocity', desc: 'Generate decks in seconds', metric: '10x' }],
      usps: ['AI Presentation Art Director'],
    },
  };

  const slides = generateSlides(project, 'general');
  const result = directorTurn(project, slides, '✦ AI Redesign');

  assert.ok(result.reply.includes('AI Redesign complete'), 'Director returns clear AI Redesign completion');
  assert.ok(result.ops.length > 0, 'Produces validated ops');
  const themeOp = result.ops.find((o) => o.op === 'updateProject')?.fields?.theme;
  assert.equal(themeOp?.accent, '#059669', 'Synchronized bespoke emerald accent from Visual DNA');
  assert.equal(themeOp?.headingFont, 'Instrument Serif', 'Synchronized bespoke typography');
});

t('creative director: handles "luxury technology presentation"', () => {
  const project = {
    id: 'p-luxury-1',
    name: 'Linear',
    url: 'https://linear.app',
    analysis: { host: 'linear.app', pages: [] },
    theme: { skin: 'light', accent: '#3b82f6' },
    understanding: { productName: 'Linear', category: 'Devtool', features: [], benefits: [], usps: [] },
  };

  const slides = generateSlides(project, 'general');
  const result = directorTurn(project, slides, 'Make it look like a luxury technology presentation');
  const themeOp = result.ops.find((o) => o.op === 'updateProject')?.fields?.theme;

  assert.equal(themeOp?.skin, 'dark', 'Switches to dark skin');
  assert.equal(themeOp?.headingFont, 'Instrument Serif', 'Sets editorial serif headlines');
  assert.equal(themeOp?.motion, 'cinematic', 'Sets cinematic motion');
  assert.ok(result.reply.includes('Luxury Technology aesthetic'), 'Acknowledges luxury aesthetic');
});

t('creative director: handles "minimal Apple-style aesthetic"', () => {
  const project = {
    id: 'p-apple-1',
    name: 'Craft',
    url: 'https://craft.do',
    analysis: { host: 'craft.do', pages: [] },
    theme: { skin: 'dark', accent: '#10B981' },
    understanding: { productName: 'Craft', category: 'Productivity', features: [], benefits: [], usps: [] },
  };

  const slides = generateSlides(project, 'general');
  const result = directorTurn(project, slides, 'Change the entire presentation to a minimal Apple-style aesthetic');
  const themeOp = result.ops.find((o) => o.op === 'updateProject')?.fields?.theme;

  assert.equal(themeOp?.skin, 'light', 'Switches to paper light skin');
  assert.equal(themeOp?.headingFont, 'Inter', 'Sets clean Inter typography');
  assert.equal(themeOp?.motion, 'calm', 'Sets calm motion');
  assert.ok(result.reply.includes('Apple aesthetic'), 'Acknowledges Apple aesthetic');
});


t('creative director: handles slide-indexed requests ("Reduce text on slide 3" and "Make slide 4 more visual")', () => {
  const project = {
    id: 'p-index-1',
    name: 'Notion',
    url: 'https://notion.so',
    analysis: { host: 'notion.so', pages: [] },
    theme: { skin: 'dark', accent: '#10B981' },
    understanding: {
      productName: 'Notion',
      category: 'Productivity Platform',
      tagline: 'The connected workspace for your wiki, docs, and projects.',
      summary: 'Notion is the all-in-one workspace for notes, tasks, wikis, and databases.',
      audience: ['teams', 'founders'],
      businessGoal: 'bring clarity and alignment to every team',
      features: [
        { name: 'Docs', desc: 'Simple, powerful, and beautiful collaborative documents.' },
        { name: 'Wikis', desc: 'Centralize your knowledge and eliminate silos.' },
      ],
      benefits: [{ title: 'All-in-one', desc: 'Replaces five fragmented tools with one workspace.' }],
      usps: ['One workspace for all team knowledge'],
    },
  };

  const slides = generateSlides(project, 'general');

  // Test "Reduce the text on slide 3"
  const reduceRes = applyCommand(project, slides, 'Reduce the text on slide 3');
  assert.ok(reduceRes.ops.some((op) => op.op === 'updateSlide' && op.id === slides[2].id), 'Targets slide 3 specifically');

  // Test "Make slide 4 more visual"
  const visualRes = applyCommand(project, slides, 'Make slide 4 more visual');
  assert.ok(visualRes.ops.some((op) => op.op === 'updateSlide' && op.id === slides[3].id && op.fields.layout === 'split'), 'Targets slide 4 with split visual layout');
});
