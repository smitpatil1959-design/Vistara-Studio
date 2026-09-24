const { createClient } = await import('@supabase/supabase-js');
const dir = await import('../server/aiDirector.js');
const eng = await import('../server/engine.js');

const proj = {
  id: 'p-test',
  theme: { accent: '#65A30D', skin: 'light' },
  analysis: { pages: [{}], links: { probed: [] } },
  audit: { overall: 80 },
  understanding: {
    schemaVersion: 'understanding.v2',
    identity: { productName: { value: 'Acme' }, tagline: { value: 't' } },
    classification: { category: { value: 'Developer Tool' } },
    audience: { primary: { value: 'devs' }, segments: [] },
    purpose: { primary: { value: 'g' } },
    value: { uniqueSellingPoint: { value: 'u' }, differentiators: [] },
    offering: { keyFeatures: [{ value: 'a — b' }], services: [], benefits: [] },
    technology: { signals: [{ value: 'Next.js' }] },
    content: { tone: { value: 'refined' } },
    story: { suggestedNarrative: { value: 's' }, sectionArc: [] },
    meta: {},
    __host: 'acme.io',
  },
};
const slides = eng.generateSlides(proj, 'investor').map((s, i) => ({ ...s, id: `s-${i}` }));

t('director: understands a preset request into a grounded plan', () => {
  const t0 = dir.directorTurn(proj, slides, 'make it cinematic', { purpose: 'investor' });
  assert.ok(t0.hasEdits);
  assert.ok(t0.plan.length >= 1);
  assert.ok(t0.context.some((c) => c.includes('investor')));
});

t('director: unknown section targets get dropped', () => {
  const t = dir.directorTurn(proj, slides, 'delete the holodeck section please', { purpose: 'investor' });
  assert.equal(t.ops.some((o) => o.op === 'deleteSlide'), false);
});

t('director: ops carry no arbitrary fields', () => {
  const t = dir.directorTurn(proj, slides, 'emerald palette + serif headlines', { purpose: 'client' });
  for (const op of t.ops) {
    if (op.op === 'updateProject' && op.fields?.theme) {
      for (const k of Object.keys(op.fields.theme)) assert.ok(['skin', 'accent', 'accent2', 'headingFont', 'bodyFont', 'motion', 'radius'].includes(k), k);
    }
  }
});

t('director: pure chat questions produce validated no-op plan', () => {
  const t = dir.directorTurn(proj, slides, 'what did we change last?', { purpose: 'investor' });
  assert.ok(['string'].includes(typeof t.reply));
  assert.ok(t.plan.length >= 1);
});

void createClient;
