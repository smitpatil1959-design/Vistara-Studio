const svc = await import('../server/understanding/service.js');

const legacy = {
  productName: 'Acme',
  tagline: 'Ship calm software.',
  category: 'Developer Tool',
  audience: ['engineering teams', 'founders'],
  businessGoal: 'compress idea-to-production',
  features: [{ name: 'Cycles', desc: 'Automatic sprints' }],
  benefits: [{ title: 'Velocity', desc: '2x faster', metric: '2x' }],
  usps: ['Zero-config sync'],
  technology: ['Next.js'],
  tone: 'refined',
};

t('lenient parser handles fenced JSON', () => {
  const out = svc.parseJsonLenient('```json\n{"a": 1}\n```');
  assert.equal(out.a, 1);
});
t('lenient parser throws on junk', () => {
  assert.throws(() => svc.parseJsonLenient('no json here'), /no JSON object/);
});

t('sanitize coerces a malformed payload into schema shape', () => {
  const clean = svc.sanitizeUnderstanding(
    { identity: { productName: { value: '  Bad ', confidence: 99, basis: 'religious' } } },
    'rules+schema',
    2,
    'x'
  );
  assert.equal(clean.identity.productName.basis, 'inferred');
  assert.equal(clean.identity.productName.confidence, 1);
  assert.deepEqual(Object.keys(clean), ['schemaVersion', 'identity', 'classification', 'audience', 'purpose', 'value', 'offering', 'technology', 'content', 'story', 'meta']);
});

t('fallback rules path product is schema-complete', () => {
  const clean = svc.sanitizeUnderstanding({}, 'rules+schema', 1, 'no key');
  for (const k of ['identity', 'classification', 'audience', 'purpose', 'value', 'offering', 'technology', 'content', 'story', 'meta']) assert.ok(k in clean, k);
});

t('flatten: rich → legacy adapter works', () => {
  const rich = svc.sanitizeUnderstanding(
    {
      identity: { productName: { value: 'Acme', basis: 'fact', confidence: 0.9, evidence: ['title'] }, tagline: { value: 'Ship calm', basis: 'fact', confidence: 1, evidence: [] } },
      classification: { category: { value: 'DevTool', basis: 'inferred', confidence: 0.5, evidence: [] } },
      audience: { primary: { value: 'teams', basis: 'inferred', confidence: 0.4, evidence: [] }, segments: [] },
      offering: { keyFeatures: [{ value: 'Cycles — automatic sprints', basis: 'fact', confidence: 0.9, evidence: ['h2'] }], benefits: [] },
      technology: { signals: [{ value: 'Next.js', basis: 'fact', confidence: 1, evidence: ['script'] }] },
      story: { sectionArc: ['hero', 'cta'] },
    },
    'test', 1, null
  );
  const flat = svc.flattenUnderstanding(rich);
  assert.equal(flat.productName, 'Acme');
  assert.equal(flat.features[0].name, 'Cycles');
  assert.equal(flat.technology[0], 'Next.js');
});

t('meta: engine note records fallback', () => {
  const c = svc.sanitizeUnderstanding({}, 'rules+schema', 1, 'LLM dropped');
  assert.match(c.meta.note, /LLM dropped/);
});
