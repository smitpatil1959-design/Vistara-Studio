import { buildSubjectProfile } from '../server/presentation/subjectProfile.js';
import { prioritizeInsights } from '../server/presentation/insightPrioritizer.js';
import { planStoryAndSlides } from '../server/presentation/storyPlanner.js';
import { writePresentationContent } from '../server/presentation/contentRewriter.js';
import { optimizeDeckLayouts } from '../server/presentation/layoutSelector.js';
import { critiqueAndRepairDeck, evaluateDeck } from '../server/presentation/presentationCritic.js';
import { generatePresentationDeck } from '../server/presentationPlanner.js';
import { validateSlideLayout } from '../server/layoutEngine.js';

/* ── Test 1: CarDekho Automotive Marketplace Pipeline ── */
t('presentation engine: CarDekho creates archetype-tailored deck with zero duplicate paragraphs and no unevidenced pricing', async () => {
  const cardekhoClaims = [
    {
      id: 'c1',
      claim: 'Thinking of buying a car? At CarDekho.com, buy new and used cars, search by filter and preferences, calculate EMI, and read reviews.',
      claim_type: 'company_description',
      source_urls: ['https://www.cardekho.com'],
    },
    {
      id: 'c2',
      claim: 'Search inventory of over 50,000 certified new and pre-owned vehicles across authorized dealerships in India.',
      claim_type: 'core_product',
      source_urls: ['https://www.cardekho.com/used-cars'],
    },
    {
      id: 'c3',
      claim: 'Instant car valuation tool provides fair market price estimations based on algorithmic transaction history.',
      claim_type: 'key_feature',
      source_urls: ['https://www.cardekho.com/car-valuation'],
    },
    {
      id: 'c4',
      claim: 'Compare vehicle specifications side-by-side across performance, mileage, safety ratings, and ownership costs.',
      claim_type: 'key_feature',
      source_urls: ['https://www.cardekho.com/compare-cars'],
    },
    {
      id: 'c5',
      claim: 'Integrated auto finance partners offer digital loan applications, EMI calculators, and instant loan approvals.',
      claim_type: 'partnerships',
      source_urls: ['https://www.cardekho.com/car-loans'],
    },
    {
      id: 'c6',
      claim: 'Images: 5 New Cars Priced Less Than The iPhone Duo! Check out the photo gallery of upcoming micro-SUVs.',
      claim_type: 'news',
      source_urls: ['https://www.cardekho.com/news/iphone-cars-123'],
    },
    {
      id: 'c7',
      claim: 'CarDekho serves over 35 million monthly active car buyers and partners with 4,000 authorized dealerships.',
      claim_type: 'stats',
      source_urls: ['https://www.cardekho.com/about'],
    },
  ];

  const project = {
    id: 'proj_cardekho',
    name: 'CarDekho: New Cars, Car Prices, Buy & Sell Used Cars in India',
    analysis: {
      description: 'Thinking of buying a car? At CarDekho.com, buy new and used cars, search by filter and preferences, calculate EMI, and read reviews.',
      screenshot: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341',
    },
  };

  const subjectInfo = {
    name: 'CarDekho',
    domain: 'cardekho.com',
    orgType: 'generic',
    description: project.analysis.description,
  };

  const { slides, profile, report } = await generatePresentationDeck({
    projectId: project.id,
    project,
    subjectInfo,
    verifiedClaims: cardekhoClaims,
    purpose: 'general',
  });

  // 1. Archetype Check
  assert.equal(profile.archetype, 'auto_marketplace', 'Archetype should be auto_marketplace');
  assert.equal(profile.capabilities.hasPricingEvidence, false, 'Should have no explicit pricing model evidence');

  // 2. Clickbait headline must NOT be a slide or card title
  const allTitles = slides.map(s => s.title);
  const hasClickbait = allTitles.some(t => /iphone/i.test(t));
  assert.equal(hasClickbait, false, 'Clickbait news article should not become a slide title');

  // 3. No unevidenced pricing slide
  const hasPricingSlide = slides.some(s => s.type === 'pricing' || /\bpricing\b/i.test(s.title));
  assert.equal(hasPricingSlide, false, 'Should NOT include an unevidenced pricing slide');

  // 4. Zero duplicate body paragraphs across slides
  const bodies = slides.map(s => s.body).filter(b => b && b.length > 25);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      assert.notEqual(bodies[i], bodies[j], `Bodies on slide ${i} and ${j} must not be identical`);
    }
  }

  // 5. Card bullets must be <= 4 and follow "Title — Detail" format
  for (const s of slides) {
    if (s.bullets && s.bullets.length > 0) {
      assert.ok(s.bullets.length <= 4, `Slide "${s.title}" has ${s.bullets.length} bullets, max is 4`);
      for (const bullet of s.bullets) {
        assert.ok(bullet.includes(' — '), `Bullet "${bullet}" must contain " — " delimiter`);
        const [head, tail] = bullet.split(' — ');
        assert.ok(head.length <= 34, `Card title "${head}" length (${head.length}) exceeds 34 chars`);
        assert.ok(tail.length <= 76, `Card detail "${tail}" length (${tail.length}) exceeds 76 chars`);
      }
    }
  }

  // 6. Critic evaluation report
  if (!report.valid) {
    console.log('CARDEKHO REPORT ISSUES:', JSON.stringify(report.issues, null, 2));
  }
  assert.ok(report.score >= 80, `Critic score should be >= 80, was ${report.score}`);
  assert.equal(report.valid, true, `Deck must be valid without critical issues: ${JSON.stringify(report.issues)}`);
});

/* ── Test 2: Uber Mobility on Demand Pipeline ── */
t('presentation engine: Uber mobility platform captures network scale without SaaS pricing slide', async () => {
  const uberClaims = [
    {
      id: 'u1',
      claim: 'Uber provides on-demand ride hailing, food delivery via Uber Eats, and freight logistics across a unified mobility platform.',
      claim_type: 'company_description',
      source_urls: ['https://www.uber.com'],
    },
    {
      id: 'u2',
      claim: 'Available in over 10,000 cities across 70 countries worldwide connecting millions of riders and drivers daily.',
      claim_type: 'stats',
      source_urls: ['https://www.uber.com/about'],
    },
    {
      id: 'u3',
      claim: 'Dynamic dispatch and algorithmic routing optimize driver positioning and reduce passenger wait times.',
      claim_type: 'technology',
      source_urls: ['https://www.uber.com/tech'],
    },
    {
      id: 'u4',
      claim: 'Safety toolkit includes real-time GPS tracking, 24/7 incident response, and emergency in-app assistance.',
      claim_type: 'key_feature',
      source_urls: ['https://www.uber.com/safety'],
    },
  ];

  const project = {
    id: 'proj_uber',
    name: 'Uber — Request a ride, order food, and explore logistics',
    analysis: { description: 'Uber connects riders, drivers, and consumers with on-demand mobility and delivery.' },
  };

  const { slides, profile } = await generatePresentationDeck({
    projectId: project.id,
    project,
    subjectInfo: { name: 'Uber', domain: 'uber.com', orgType: 'generic' },
    verifiedClaims: uberClaims,
    purpose: 'general',
  });

  assert.equal(profile.archetype, 'mobility_on_demand', 'Uber archetype must be mobility_on_demand');
  const hasPricingSlide = slides.some(s => s.type === 'pricing');
  assert.equal(hasPricingSlide, false, 'Mobility platform must not generate a SaaS pricing slide');
  assert.ok(slides.length >= 5, `Deck should have at least 5 slides, got ${slides.length}`);
});

/* ── Test 3: Higher Education (Stanford University) ── */
t('presentation engine: Higher education produces academic narrative with zero SaaS pricing or commercial tiers', async () => {
  const stanfordClaims = [
    {
      id: 's1',
      claim: 'Stanford University is a leading global research institution offering undergraduate, graduate, and doctoral degree programs.',
      claim_type: 'company_description',
      source_urls: ['https://www.stanford.edu'],
    },
    {
      id: 's2',
      claim: 'Seven academic schools spanning engineering, humanities and sciences, medicine, law, business, and education.',
      claim_type: 'core_product',
      source_urls: ['https://www.stanford.edu/academics'],
    },
    {
      id: 's3',
      claim: 'Over 6,000 externally sponsored research projects advancing clean energy, biomedical breakthroughs, and artificial intelligence.',
      claim_type: 'stats',
      source_urls: ['https://www.stanford.edu/research'],
    },
    {
      id: 's4',
      claim: 'Need-blind admissions and comprehensive financial aid ensuring access for admitted students regardless of family finances.',
      claim_type: 'key_feature',
      source_urls: ['https://www.stanford.edu/admission'],
    },
  ];

  const project = {
    id: 'proj_stanford',
    name: 'Stanford University',
    analysis: { description: 'Stanford University is located in California.' },
  };

  const { slides, profile } = await generatePresentationDeck({
    projectId: project.id,
    project,
    subjectInfo: { name: 'Stanford University', domain: 'stanford.edu', orgType: 'higher_education' },
    verifiedClaims: stanfordClaims,
    purpose: 'general',
  });

  assert.equal(profile.archetype, 'higher_education');
  assert.equal(profile.capabilities.hasPricingEvidence, false);

  const hasCommercialPricing = slides.some(s => s.type === 'pricing' || /pricing tiers|subscription/i.test(s.title));
  assert.equal(hasCommercialPricing, false, 'Academic deck must never contain commercial pricing tiers');
});

/* ── Test 4: Spatial Layout & Collision Safety ── */
t('presentation engine: all generated slides fit 16:9 safe margins with zero card overlap and diverse rhythm', async () => {
  const claims = [
    { id: '1', claim: 'Enterprise cloud infrastructure orchestrator for distributed microservices.', claim_type: 'core_product' },
    { id: '2', claim: 'Automated failover reduces downtime to under 50 milliseconds across global zones.', claim_type: 'key_feature' },
    { id: '3', claim: 'End-to-end cryptographic mutual TLS guarantees zero-trust network verification.', claim_type: 'security' },
    { id: '4', claim: 'Supports over 100,000 concurrent cluster nodes with sub-second telemetry indexing.', claim_type: 'stats' },
    { id: '5', claim: 'Integrates natively with Kubernetes, Terraform, AWS, and GCP management planes.', claim_type: 'integrations' },
  ];

  const project = {
    id: 'proj_infra',
    name: 'InfraScale Cloud',
    analysis: { description: 'InfraScale provides cloud management tools.' },
  };

  const { slides } = await generatePresentationDeck({
    projectId: project.id,
    project,
    subjectInfo: { name: 'InfraScale', domain: 'infrascale.io' },
    verifiedClaims: claims,
    purpose: 'technical',
  });

  // Verify spatial bounding boxes for every single slide
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    const validation = validateSlideLayout(s);
    assert.equal(validation.valid, true, `Slide ${i + 1} (${s.title}) failed spatial validation: ${JSON.stringify(validation.issues)}`);
  }

  // Verify visual rhythm: no 3 consecutive slides have the exact same layout
  let consecutive = 1;
  for (let i = 1; i < slides.length; i++) {
    if (slides[i].layout === slides[i - 1].layout && slides[i].layout !== 'hero' && slides[i].layout !== 'conclusion') {
      consecutive++;
      assert.ok(consecutive < 3, `Visual monotony detected: slides ${i - 1}, ${i}, ${i + 1} all use layout "${slides[i].layout}"`);
    } else {
      consecutive = 1;
    }
  }
});
