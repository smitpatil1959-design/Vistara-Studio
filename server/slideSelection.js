/**
 * Dynamic Slide Selection Engine
 *
 * Selects 8–15 presentation slides based on available verified evidence.
 * No hardcoded templates — adapts to org type and evidence richness.
 *
 * Algorithm:
 *   1. Load verified + supported claims
 *   2. Build evidence map (claim_type → count)
 *   3. Infer org type from evidence patterns
 *   4. Score each candidate slide type (evidence count × authority × relevance)
 *   5. Select top N slides (between minSlides and maxSlidesTarget)
 *   6. Always: Cover (first) + Conclusion (last)
 *   7. Never create filler slides — if evidence doesn't support a slide, omit it
 */

import supabase from './db-client.js';
import config from './config.js';

/** All possible slide types with their evidence requirements */
const SLIDE_CATALOG = [
  // Introduction
  { type: 'cover',                 title: 'Introduction',          claimTypes: [],                                          required: true,  minEvidence: 0,  order: 1   },
  { type: 'about',                 title: 'Overview',              claimTypes: ['company_description', 'industry'],          required: false, minEvidence: 1,  order: 10  },
  { type: 'what_it_does',         title: 'What It Does',          claimTypes: ['company_description', 'product', 'service'], required: false, minEvidence: 1,  order: 15  },

  // Product / Service
  { type: 'product',               title: 'Products & Services',   claimTypes: ['product', 'service'],                      required: false, minEvidence: 2,  order: 20  },
  { type: 'features',              title: 'Key Features',          claimTypes: ['feature'],                                 required: false, minEvidence: 2,  order: 25  },
  { type: 'integrations',          title: 'Integrations',          claimTypes: ['integration'],                             required: false, minEvidence: 2,  order: 27  },

  // Audience
  { type: 'audience',              title: 'Who It Serves',         claimTypes: ['audience', 'customer'],                   required: false, minEvidence: 1,  order: 30  },
  { type: 'use_cases',            title: 'Use Cases',             claimTypes: ['customer', 'audience'],                   required: false, minEvidence: 2,  order: 35  },

  // Business
  { type: 'business_model',       title: 'Business Model',        claimTypes: ['business_model'],                          required: false, minEvidence: 2,  order: 40  },
  { type: 'pricing',               title: 'Pricing',               claimTypes: ['pricing'],                                 required: false, minEvidence: 1,  order: 45  },
  { type: 'geographic_presence',   title: 'Geographic Presence',   claimTypes: ['location'],                                required: false, minEvidence: 2,  order: 50  },

  // Market
  { type: 'market',                title: 'Market & Industry',     claimTypes: ['market', 'industry'],                     required: false, minEvidence: 2,  order: 55  },
  { type: 'competitive_landscape', title: 'Competitive Landscape', claimTypes: ['competitor'],                              required: false, minEvidence: 2,  order: 60  },
  { type: 'differentiators',       title: 'Differentiators',       claimTypes: ['differentiator', 'feature'],               required: false, minEvidence: 2,  order: 65  },

  // Technical
  { type: 'technology',            title: 'Technology',            claimTypes: ['technology'],                              required: false, minEvidence: 2,  order: 70  },
  { type: 'security',              title: 'Security & Compliance', claimTypes: ['security'],                                required: false, minEvidence: 2,  order: 75  },

  // Social proof / growth
  { type: 'partnerships',          title: 'Partnerships',          claimTypes: ['partnership'],                             required: false, minEvidence: 2,  order: 80  },
  { type: 'metrics',               title: 'By the Numbers',        claimTypes: ['metric'],                                  required: false, minEvidence: 2,  order: 85  },
  { type: 'funding_context',       title: 'Growth & Funding',      claimTypes: ['metric', 'founder'],                      required: false, minEvidence: 2,  order: 87  },
  { type: 'leadership',            title: 'Leadership',            claimTypes: ['leadership', 'founder'],                   required: false, minEvidence: 2,  order: 90  },

  // Recency
  { type: 'news',                  title: 'Recent Developments',   claimTypes: ['news'],                                    required: false, minEvidence: 2,  order: 95  },

  // Conclusion
  { type: 'conclusion',            title: 'Summary',               claimTypes: [],                                          required: true,  minEvidence: 0,  order: 100 },
];

/**
 * Purpose-specific slide priority boosts.
 * Canonical UI purposes: college | investor | client | product-demo | portfolio | general
 * Research-platform aliases: investor_research | competitor_analysis | sales_presentation | product_research | company_overview | market_research
 *
 * These boosts are additive signals only — evidence eligibility always gates first.
 * A boost cannot create a slide where evidence doesn't support it.
 */
const PURPOSE_PRIORITY_BOOSTS = {
  // ── Canonical UI purposes ─────────────────────────────────────────────────
  college: {
    // Academic: background, methodology, findings, analysis, conclusion
    about: 2, what_it_does: 2, metrics: 1, market: 1, news: 1,
  },
  investor: {
    // Traction, scale, competitive moat, growth signals, business model
    metrics: 3, funding_context: 3, leadership: 2, competitive_landscape: 2, business_model: 2, differentiators: 1,
  },
  client: {
    // Confidence, value delivery, capabilities, proof, offerings
    use_cases: 3, differentiators: 2, features: 2, what_it_does: 2, partnerships: 1,
  },
  'product-demo': {
    // Workflows, features, UX, use cases, technical depth
    product: 2, features: 3, integrations: 2, technology: 2, use_cases: 2,
  },
  portfolio: {
    // Identity, craft, range, projects, differentiators, visual work
    what_it_does: 2, differentiators: 3, technology: 2, about: 1, news: 1,
  },
  general: {
    // Balanced — no directional bias
  },

  // ── Research-platform aliases (kept for backward compat) ──────────────────
  investor_research:   { metrics: 3, funding_context: 3, leadership: 2, competitive_landscape: 2, business_model: 2 },
  competitor_analysis: { competitive_landscape: 3, differentiators: 3, pricing: 2, market: 2, features: 1 },
  sales_presentation:  { use_cases: 3, differentiators: 2, features: 2, pricing: 2, partnerships: 1 },
  product_research:    { product: 2, features: 3, integrations: 2, technology: 2, pricing: 1 },
  company_overview:    { about: 2, what_it_does: 2, audience: 1, news: 1 },
  market_research:     { market: 3, competitive_landscape: 3, geographic_presence: 2, metrics: 2 },
};

/**
 * Select appropriate slides for a project based on available evidence.
 * @param {string} projectId
 * @param {string} purpose
 * @param {{ subjectInfo?: Object }} options
 * @returns {Promise<Array>} Slide configurations
 */
export async function selectSlidesForPresentation(projectId, purpose = 'general', options = {}) {
  const { subjectInfo } = options;

  try {
    const { data: claims, error: claimsErr } = await supabase
      .from('claims')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['verified', 'supported'])
      .order('confidence', { ascending: false });

    if (claimsErr) {
      console.error('[selectSlides] claims fetch error:', claimsErr);
      throw claimsErr;
    }

    if (!claims || claims.length === 0) {
      console.warn('[selectSlides] no verified claims found — returning minimum set');
      return getMinimumPresentation();
    }

    // Build evidence counts
    const evidenceMap = buildEvidenceMap(claims);

    // Infer org type from evidence patterns if not provided
    const orgType = subjectInfo?.orgType || inferOrgTypeFromEvidence(evidenceMap);

    // Score and select slides
    const selected = scoredSlideSelection(evidenceMap, purpose, orgType, claims);

    console.log(`[selectSlides] Selected ${selected.length} slides for ${purpose} (${orgType}) | evidence types: ${Object.entries(evidenceMap).filter(([,v]) => v > 0).map(([k,v]) => `${k}:${v}`).join(', ')}`);

    return selected;
  } catch (err) {
    console.error('[selectSlidesForPresentation]', err);
    return getMinimumPresentation();
  }
}

/**
 * Build a map of evidence type → count from claims
 */
function buildEvidenceMap(claims) {
  const map = {};
  for (const c of claims) {
    map[c.claim_type] = (map[c.claim_type] || 0) + 1;
  }
  return map;
}

/**
 * Infer org type from evidence patterns when not provided by orchestrator.
 */
function inferOrgTypeFromEvidence(evidenceMap) {
  const { pricing = 0, integration = 0, location = 0, audience = 0, feature = 0, metric = 0 } = evidenceMap;

  if (pricing > 2 && integration > 2 && feature > 3) return 'saas';
  if (location > 3) return 'restaurant_consumer';
  if (pricing > 0 && audience > 0 && feature > 0) return 'ecommerce';
  return 'generic';
}

/**
 * Score each slide type and select the best set.
 */
function scoredSlideSelection(evidenceMap, purpose, orgType, claims) {
  const purposeBoosts = PURPOSE_PRIORITY_BOOSTS[purpose] || {};
  // No floor — evidence determines count. Safety max prevents runaway expansion.
  const max = config.slideSafetyMax || 16;

  const scored = SLIDE_CATALOG.map(slide => {
    if (slide.required) return { ...slide, score: slide.type === 'cover' ? 999 : 998, evidenceCount: 0 };

    // Count supporting evidence
    const evidenceCount = slide.claimTypes.reduce((sum, ct) => sum + (evidenceMap[ct] || 0), 0);

    // Skip if insufficient evidence
    if (evidenceCount < slide.minEvidence) return null;

    // Base score from evidence
    let score = evidenceCount * 10;

    // Purpose boost
    score += (purposeBoosts[slide.type] || 0) * 15;

    // Org-type relevance boosts
    score += getOrgTypeRelevanceBoost(slide.type, orgType);

    return { ...slide, score, evidenceCount };
  }).filter(Boolean);

  // Separate required from optional
  const required = scored.filter(s => s.required);
  const optional = scored.filter(s => !s.required && s.score > 0).sort((a, b) => b.score - a.score);

  // No minimum slide count — include all evidence-supported optional slides up to safety max
  const targetOptional = Math.min(max - required.length, optional.length);
  const selectedOptional = optional.slice(0, targetOptional);

  // Combine and sort by order
  const all = [...required, ...selectedOptional].sort((a, b) => a.order - b.order);

  // Re-number
  return all.map((s, i) => ({
    ...s,
    order: i + 1,
  }));
}

/**
 * Org-type relevance boost for specific slide types.
 * Makes presentations naturally appropriate for each kind of organization.
 */
function getOrgTypeRelevanceBoost(slideType, orgType) {
  const boosts = {
    saas: { pricing: 20, features: 20, integrations: 20, technology: 15, security: 15, competitive_landscape: 10 },
    marketplace: { geographic_presence: 20, business_model: 20, metrics: 15, partnerships: 10 },
    restaurant_consumer: { geographic_presence: 25, partnerships: 15, business_model: 20 },
    university: { product: 20, geographic_presence: 15, leadership: 10, metrics: 10 },
    nonprofit: { audience: 25, metrics: 15, leadership: 10 },
    fintech: { security: 25, pricing: 15, metrics: 20 },
    healthtech: { security: 25, partnerships: 15, metrics: 20 },
    media: { audience: 20, metrics: 20 },
    ecommerce: { product: 15, pricing: 15, geographic_presence: 10 },
    startup: { funding_context: 20, leadership: 15, competitive_landscape: 10 },
  };

  return (boosts[orgType]?.[slideType] || 0);
}

/**
 * Minimum presentation when evidence is very sparse.
 */
function getMinimumPresentation() {
  return [
    { type: 'cover',       title: 'Overview',     claimTypes: [],                               required: true,  order: 1 },
    { type: 'about',       title: 'About',         claimTypes: ['company_description'],          required: false, order: 2 },
    { type: 'product',     title: 'Products',      claimTypes: ['product', 'service'],           required: false, order: 3 },
    { type: 'conclusion',  title: 'Summary',       claimTypes: [],                               required: true,  order: 4 },
  ];
}
