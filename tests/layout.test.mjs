import { validateSlideLayout, repairSlideSpatialCollision, CANVAS, boxesIntersect } from '../server/layoutEngine.js';
import { generateSlides, validateAndRepairDeck } from '../server/engine.js';

// ---------------------------------------------------------------- Spatial Layout & Collision Tests

t('layout engine: detects intersecting bounding boxes accurately', () => {
  const boxA = { id: 'A', x: 56, y: 48, w: 500, h: 200 };
  const boxB = { id: 'B', x: 400, y: 100, w: 400, h: 200 }; // Overlaps boxA
  const boxC = { id: 'C', x: 600, y: 300, w: 400, h: 200 }; // Disjoint

  assert.ok(boxesIntersect(boxA, boxB), 'Box A and Box B intersect');
  assert.ok(!boxesIntersect(boxA, boxC), 'Box A and Box C do not intersect');
});

t('layout engine: validates and repairs overflowing card content', () => {
  const overflowingSlide = {
    type: 'features',
    title: 'An extremely long heading that goes on and on and will definitely blowout if not properly clamped by the layout engine',
    subtitle: 'This is a super long subtitle that should be concise to maintain the safe vertical budget of the presentation canvas',
    body: 'A very verbose paragraph describing multiple unrelated details that would crowd the presentation header zone and push content into the footer.',
    bullets: [
      'Overstuffed Feature Title That Exceeds Card Bounds — A massive wall of text that would normally spill out of the card and collide with adjacent elements on the canvas because it contains far too much unstructured explanation.',
      'Second Huge Bullet That Overflows — Another huge paragraph explaining intricate nuances that should be tightly summarized for slide presentation clarity.',
      'Third Feature — Clean and tight summary.',
    ],
  };

  const repaired = repairSlideSpatialCollision(overflowingSlide);
  assert.ok(repaired.title.length <= 68, `Title was clamped to safe length: ${repaired.title.length}`);
  assert.ok(repaired.subtitle.length <= 95, `Subtitle was clamped to safe length: ${repaired.subtitle.length}`);
  assert.ok(repaired.body.length <= 170, `Body was clamped to safe length: ${repaired.body.length}`);

  const validation = validateSlideLayout(repaired);
  assert.ok(validation.valid, `Repaired slide passes spatial validation with zero issues: ${JSON.stringify(validation.issues)}`);
});

t('layout engine: all generated slides in a full deck are collision-free and fit 16:9 canvas', () => {
  const project = {
    id: 'p-stripe-1',
    name: 'Stripe',
    url: 'https://stripe.com',
    analysis: {
      host: 'stripe.com',
      pages: [{ url: 'https://stripe.com', title: 'Stripe: Financial Infrastructure' }],
      tech: [{ name: 'React', category: 'Framework' }],
      screenshot: 'https://stripe.com/hero.png',
    },
    understanding: {
      productName: 'Stripe',
      category: 'Fintech',
      tagline: 'Financial infrastructure for the internet. Millions of companies use Stripe to accept payments.',
      summary: 'Stripe powers online and in-person payments for businesses around the world.',
      audience: ['developers', 'founders', 'finance teams'],
      businessGoal: 'make money movement instant, global, and reliable',
      features: [
        { name: 'Payments', desc: 'Accept payments globally with smart routing and anti-fraud.' },
        { name: 'Billing', desc: 'Automate recurring subscriptions and tiered billing.' },
        { name: 'Connect', desc: 'Route funds to marketplaces and multi-party platforms.' },
      ],
      benefits: [
        { title: 'Global reach', desc: 'Accept 135+ currencies with local payment methods.', metric: '135+' },
        { title: 'High uptime', desc: 'Enterprise-grade reliability for peak transaction days.', metric: '99.999%' },
      ],
      usps: ['Full financial stack in one API', 'Industry-leading authorization rates', 'Global compliance out of the box'],
      technology: ['React', 'TypeScript'],
      tone: 'refined',
      host: 'stripe.com',
    },
  };

  const slides = generateSlides(project, 'general');
  assert.equal(slides.length, 11);

  for (const [idx, slide] of slides.entries()) {
    const res = validateSlideLayout(slide);
    assert.ok(res.valid, `Slide ${idx + 1} (${slide.type}) failed spatial layout validation: ${JSON.stringify(res.issues)}`);
  }
});
