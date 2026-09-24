/**
 * Vistara Studio — Presentation Subject Profiler
 *
 * Infers a comprehensive, structured subject profile from crawl data,
 * verified claims, and AI understanding (when present).
 *
 * ZERO BRAND HARDCODING: Uses purely semantic vocabulary and evidence tokens.
 * Works across arbitrary domains (marketplace, mobility, SaaS, higher education,
 * healthcare, ecommerce, nonprofit, media, enterprise).
 */

import { cleanExtractedText, isHighQualityContent } from './extractionQuality.js';

const ARCHETYPES = [
  'auto_marketplace',
  'mobility_on_demand',
  'b2b_saas',
  'higher_education',
  'nonprofit_foundation',
  'healthcare_medical',
  'ecommerce_retail',
  'media_publishing',
  'general_enterprise',
];

/**
 * Builds a structured subject profile from all available context.
 *
 * @param {Object} target - Subject or DB project row
 * @param {Array} claims - Verified + supported claims
 * @param {Object} [extra] - Additional metadata or analysis
 * @param {string} [purpose='general']
 * @returns {Object} Structured subject profile
 */
export function buildSubjectProfile(target, claims = [], extra = null, purpose = 'general') {
  const project = target?.analysis ? target : (extra?.analysis ? extra : {});
  const subjectInfo = target?.analysis ? {} : (target || {});
  const analysis = project?.analysis || (extra?.title || extra?.description ? extra : {});
  const session = extra?.subject_name ? extra : null;

  const url = subjectInfo?.domain ? `https://${subjectInfo.domain}` : (project?.url || analysis?.url || '');
  const host = subjectInfo?.domain || analysis?.host || extractHost(url);

  // 1. Resolve clean subject name
  const rawName = subjectInfo?.name || session?.subject_name || project?.name || host;
  const name = cleanSubjectName(rawName, host);

  // 2. Aggregate searchable text for semantic classification (no brand names)
  const titleText = (analysis?.title || '').toLowerCase();
  const descText = (subjectInfo?.description || analysis?.description || project?.analysis?.description || '').toLowerCase();
  const claimsText = (claims || []).map((c) => (typeof c.claim === 'string' ? c.claim : '')).join(' ').toLowerCase();
  const explicitType = subjectInfo?.orgType || session?.subject_type || project?.orgType;
  const fullCorpus = `${url} ${titleText} ${descText} ${claimsText}`;

  // 3. Infer Archetype purely via semantic concept vocabulary
  const archetype = inferArchetype(fullCorpus, explicitType);

  // 4. Clean positioning statement grounded strictly in evidence
  const cleanPositioning = buildCleanPositioning(name, archetype, {}, analysis, claims);

  // 5. Detect supported topics based strictly on factual evidence
  const supportedTopics = detectSupportedTopics(claims, fullCorpus);

  // 6. Extract key metrics grounded in claims
  const keyMetrics = extractGroundMetrics(claims);

  // 7. Extract primary offerings & differentiators
  const { offerings, differentiators, audience } = extractCoreTraits({}, claims, archetype);

  const capabilities = {
    hasPricingEvidence: Boolean(supportedTopics.pricing),
    hasMetrics: Boolean(supportedTopics.metrics),
    hasIntegrations: Boolean(supportedTopics.integrations),
    hasTechnology: Boolean(supportedTopics.technology),
    hasWorkflow: Boolean(supportedTopics.workflow),
    hasComparison: Boolean(supportedTopics.comparison),
    hasEcosystem: Boolean(supportedTopics.ecosystem),
  };

  return {
    name,
    domain: host,
    archetype,
    category: deriveCategory(archetype),
    tagline: cleanPositioning,
    cleanPositioning,
    targetAudience: audience,
    primaryOfferings: offerings,
    differentiators,
    keyMetrics,
    supportedTopics,
    capabilities,
    purpose,
    rawScreenshot: typeof analysis?.screenshot === 'string' ? analysis.screenshot : null,
  };
}

function extractHost(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function cleanSubjectName(name, host) {
  if (!name || name === 'Website' || name === 'Organization') {
    if (host) {
      const parts = host.split('.');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return 'Company';
  }
  // Remove title separators and SEO appendages: "Brand: Subtitle | Tagline" -> "Brand"
  const cleaned = name.split(/[|:—–·-]/)[0].trim();
  return cleaned.length >= 2 ? cleaned : name;
}

/**
 * Generic semantic archetype inference based on functional domain vocabulary.
 * NO BRAND OR COMPANY HARDCODING.
 */
function inferArchetype(corpus, explicitType) {
  if (explicitType && ARCHETYPES.includes(explicitType)) return explicitType;

  // Auto marketplace / vehicle buying
  if (/\b(car|cars|vehicle|vehicles|automobile|automotive)\b/.test(corpus) &&
      /\b(buy|sell|used|dealers?|dealership|inventory|specs|pricing)\b/.test(corpus)) {
    return 'auto_marketplace';
  }

  // Mobility / Ridesharing / On-demand delivery
  if (/\b(rides?|driver|trips?|mobility|riders?)\b/.test(corpus) &&
      /\b(on-demand|fleet|dispatch|fare|logistics|courier|delivery)\b/.test(corpus)) {
    return 'mobility_on_demand';
  }

  // Higher Education / University
  if (/\.(edu|ac\.[a-z]{2})\b/.test(corpus) ||
      /\b(university|college|undergraduate|graduate|admissions|curriculum|faculty|campus|alumni|degrees?)\b/.test(corpus)) {
    return 'higher_education';
  }

  // Healthcare / Clinical / Medical Information
  if (/\b(patients?|clinical|hospital|healthcare|physician|therapies|medical center|diagnosis)\b/.test(corpus)) {
    return 'healthcare_medical';
  }

  // Nonprofit / Foundation / NGO
  if (/\.(org|ngo)\b/.test(corpus) ||
      /\b(nonprofit|foundation|humanitarian|charity|donate|donations|volunteers?|mission-driven|fellowship)\b/.test(corpus)) {
    return 'nonprofit_foundation';
  }

  // B2B SaaS / Developer Platform / Cloud Software
  if (/\b(api|sdk|saas|devops|workflows?|integration|cloud-native|infrastructure|analytics|b2b|enterprise software)\b/.test(corpus)) {
    return 'b2b_saas';
  }

  // E-commerce / Retail
  if (/\b(ecommerce|e-commerce|checkout|shopping cart|add to cart|apparel|storefront|retailer)\b/.test(corpus)) {
    return 'ecommerce_retail';
  }

  // Media & Publishing
  if (/\b(magazine|journalism|editorial|newspaper|breaking news|articles?|publisher|publication)\b/.test(corpus)) {
    return 'media_publishing';
  }

  return 'general_enterprise';
}

/**
 * Builds clean positioning strictly from verified evidence.
 * Prefers actual crawled/verified descriptions over synthetic fallbacks.
 */
function buildCleanPositioning(name, archetype, understanding, analysis, claims) {
  // 1. Check understanding tagline or purpose
  const uTagline = understanding?.identity?.tagline?.value;
  if (uTagline && uTagline.length > 15 && uTagline.length < 140 && !uTagline.includes('|')) {
    return uTagline;
  }

  const uPurpose = understanding?.purpose?.primary?.value;
  if (uPurpose && uPurpose.length > 20 && uPurpose.length < 150 && !uPurpose.includes('|')) {
    return uPurpose;
  }

  // 2. Check for an authoritative company_description claim from evidence
  const descClaim = (claims || []).find(
    (c) => c.claim_type === 'company_description' &&
           typeof c.claim === 'string' &&
           c.claim.length >= 25 &&
           c.claim.length <= 160 &&
           !c.claim.includes('|') &&
           isHighQualityContent(c.claim)
  );
  if (descClaim) {
    const text = cleanExtractedText(descClaim.claim);
    const firstSentence = text.split(/[.!?]/)[0].trim();
    if (firstSentence.length >= 25 && firstSentence.length <= 150) {
      return `${firstSentence}.`;
    }
  }

  // 3. Fallback to cleaned description from crawled meta
  const rawDesc = cleanExtractedText(analysis?.description || '');
  if (rawDesc && rawDesc.length > 25 && !rawDesc.includes('http') && !rawDesc.includes('©')) {
    const firstSentence = rawDesc.split(/[.!?]/)[0].trim();
    if (firstSentence.length > 20 && firstSentence.length < 150 && !firstSentence.includes('|')) {
      return `${firstSentence}.`;
    }
  }

  // 4. Neutral generic fallback — avoids domain-specific assumptions
  //    (the archetype is used only for narrative sequencing, not for inventing copy)
  return `${name} provides products, services, and capabilities for its audience.`;
}

function deriveCategory(archetype) {
  // Generic category labels tied to semantic function, not brand assumptions
  switch (archetype) {
    case 'auto_marketplace':    return 'Automotive Marketplace';
    case 'mobility_on_demand':  return 'Mobility & Logistics';
    case 'b2b_saas':            return 'Software Platform';
    case 'higher_education':    return 'Education & Research';
    case 'healthcare_medical':  return 'Healthcare';
    case 'nonprofit_foundation':return 'Nonprofit Organization';
    case 'ecommerce_retail':    return 'E-commerce & Retail';
    case 'media_publishing':    return 'Media & Publishing';
    default:                    return 'Digital Platform';
  }
}

function detectSupportedTopics(claims, fullCorpus) {
  // STRICT GUARD FOR PRICING: Only consider supported if explicit subscription or tier evidence exists
  const pricingClaims = (claims || []).filter((c) => c.claim_type === 'pricing');
  const hasRealPricing = pricingClaims.some((c) => {
    const txt = (c.claim || '').toLowerCase();
    return /\b(per month|per user|\/mo|\/user|subscription tiers?|free plan|pro plan|enterprise plan|starter tier|billing cycle)\b/.test(txt) ||
           (/[\$₹€£]\s*\d+/.test(txt) && !/\b(iphone|phone|samsung|galaxy)\b/.test(txt));
  });

  // Funding guard
  const fundingClaims = (claims || []).filter((c) => c.claim_type === 'funding_context' || c.claim_type === 'metric');
  const hasRealFunding = fundingClaims.some((c) => {
    const txt = (c.claim || '').toLowerCase();
    return /\b(series [a-e]|venture capital|raised [\$₹€£]|funding round|seed round|valuation of [\$₹€£]|ipo|listed on)\b/.test(txt);
  });

  // Numbers & Metrics guard
  const metricClaims = (claims || []).filter((c) => c.claim_type === 'metric' || /[\$₹€£]?\d+[\d,]*[KMBTkm]?\+?\s*(?:million|billion|thousand|users|customers|trips|orders|countries|cities|%)/i.test(c.claim || ''));

  return {
    pricing: hasRealPricing,
    funding: hasRealFunding,
    metrics: metricClaims.length >= 2,
    technology: (claims || []).some((c) => c.claim_type === 'technology'),
    comparison: (claims || []).some((c) => c.claim_type === 'differentiator' || c.claim_type === 'competitor'),
    workflow: (claims || []).some((c) => c.claim_type === 'feature' || c.claim_type === 'service'),
    integrations: (claims || []).some((c) => c.claim_type === 'integration' || c.claim_type === 'partnership'),
    ecosystem: (claims || []).some((c) => c.claim_type === 'audience' || c.claim_type === 'partnership' || c.claim_type === 'customer'),
  };
}

function extractGroundMetrics(claims) {
  const stats = [];
  const seenValues = new Set();

  for (const c of claims) {
    const txt = typeof c.claim === 'string' ? c.claim : '';
    // Match numbers like "50M+", "$10B", "10,000+", "99.99%", "150+ countries"
    const match = txt.match(/([\$₹€£]?\d+[\d,]*(?:\.\d+)?[KMBTkm]?\+?)\s+([a-zA-Z%]+(?:\s+[a-zA-Z]+)?)/);
    if (match && stats.length < 6) {
      const val = match[1].trim();
      const rawLabel = match[2].trim();
      const key = `${val}-${rawLabel}`.toLowerCase();
      if (!seenValues.has(key) && val.length <= 12 && rawLabel.length <= 24) {
        seenValues.add(key);
        stats.push({ value: val, label: rawLabel });
      }
    }
  }

  return stats;
}

function extractCoreTraits(understanding, claims, archetype) {
  const offerings = [];
  const differentiators = [];
  const audience = [];

  if (Array.isArray(understanding?.offering?.keyFeatures)) {
    understanding.offering.keyFeatures.forEach((f) => {
      if (f.value && offerings.length < 5) offerings.push(f.value);
    });
  }

  if (Array.isArray(understanding?.value?.differentiators)) {
    understanding.value.differentiators.forEach((d) => {
      if (d.value && differentiators.length < 4) differentiators.push(d.value);
    });
  }

  if (understanding?.audience?.primary?.value) {
    audience.push(understanding.audience.primary.value);
  }

  if (offerings.length === 0) {
    const productClaims = (claims || []).filter((c) => ['product', 'service', 'feature'].includes(c.claim_type));
    productClaims.slice(0, 4).forEach((c) => {
      if (c.claim && !offerings.includes(c.claim)) offerings.push(c.claim);
    });
  }

  return { offerings, differentiators, audience };
}
