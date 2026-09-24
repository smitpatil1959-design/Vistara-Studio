/**
 * Vistara Studio — Generic Presentation Story & Slide Planner v2
 *
 * Discovers the appropriate presentation narrative from EVIDENCE, not from
 * a fixed template. Zero hardcoded archetype assumptions.
 *
 * Purpose is a first-class signal:
 *   - Changes topic priority weights (which evidence clusters get elevated)
 *   - Changes narrative arc (topic ordering preference)
 *   - Changes copy angle signal passed to the content layer
 * BUT purpose never dictates slide types or content — evidence does.
 *
 * Pipeline:
 *   1. Inspect cluster richness → determine which topics have evidence
 *   2. Apply purpose-aware scoring to candidate topics
 *   3. Singleton quality gate — low-quality orphan claims absorbed into neighbors
 *   4. Reorder topics into a purpose-tuned narrative arc
 *   5. Check closing slide eligibility (optional — not always emitted)
 *   6. Assign evidence-derived titles (never preset strings)
 *   7. Track a 4-layer claim-usage registry (exact / normalized / Jaccard / entity-predicate)
 *   8. Determine slide count dynamically — no minimum, safety max of 16
 */

import { jaccardSimilarity, tokenize } from './presentationCritic.js';

// ---------------------------------------------------------------------------
// Canonical Purpose Map
// Maps every valid purpose string to a narrative profile.
// Same website + different purpose → different arc + emphasis.
// Different websites + same purpose → different slides (evidence-driven).
// ---------------------------------------------------------------------------

const PURPOSE_PROFILES = {
  // UI purposes
  college: {
    label: 'College Project',
    arc: ['context', 'core_purpose', 'capabilities', 'audience', 'differentiators', 'metrics', 'technology'],
    boosts: { context: 3, core_purpose: 2, capabilities: 2, audience: 1 },
    copyAngle: 'analytical, methodical, evidence-cited — appropriate for academic review',
  },
  investor: {
    label: 'Investor Briefing',
    arc: ['core_purpose', 'metrics', 'differentiators', 'capabilities', 'ecosystem', 'audience', 'pricing'],
    boosts: { metrics: 4, differentiators: 3, ecosystem: 2, pricing: 2, core_purpose: 1 },
    copyAngle: 'traction-first, quantified outcomes, competitive moat, growth trajectory',
  },
  client: {
    label: 'Client Presentation',
    arc: ['core_purpose', 'capabilities', 'differentiators', 'audience', 'ecosystem', 'metrics'],
    boosts: { capabilities: 3, differentiators: 3, audience: 2, ecosystem: 1 },
    copyAngle: 'confidence, value delivery, concrete proof — ideal for winning trust quickly',
  },
  'product-demo': {
    label: 'Product Demo',
    arc: ['core_purpose', 'offerings', 'capabilities', 'technology', 'differentiators', 'metrics'],
    boosts: { offerings: 3, capabilities: 3, technology: 2, differentiators: 1 },
    copyAngle: 'flow-oriented, show-don\'t-tell, feature-specific, user-journey framing',
  },
  portfolio: {
    label: 'Portfolio Review',
    arc: ['context', 'differentiators', 'technology', 'offerings', 'capabilities', 'metrics'],
    boosts: { differentiators: 3, technology: 2, capabilities: 2, context: 2 },
    copyAngle: 'craft-forward, range-demonstrating, identity-led — quality over quantity',
  },
  general: {
    label: 'General Presentation',
    arc: ['context', 'core_purpose', 'offerings', 'capabilities', 'differentiators', 'audience', 'metrics', 'technology', 'ecosystem', 'pricing'],
    boosts: {},
    copyAngle: 'balanced, boardroom-safe, evidence-grounded narrative',
  },

  // Research-platform purposes (alias-mapped to same profiles)
  company_overview: {
    label: 'Company Overview',
    arc: ['core_purpose', 'audience', 'offerings', 'capabilities', 'metrics', 'ecosystem'],
    boosts: { core_purpose: 2, audience: 2, ecosystem: 1 },
    copyAngle: 'comprehensive, authoritative, mission-first narrative',
  },
  investor_research: {
    label: 'Investor Research',
    arc: ['core_purpose', 'metrics', 'differentiators', 'capabilities', 'ecosystem', 'audience', 'pricing'],
    boosts: { metrics: 4, differentiators: 3, ecosystem: 2, pricing: 2 },
    copyAngle: 'traction-first, quantified outcomes, competitive moat, growth trajectory',
  },
  competitor_analysis: {
    label: 'Competitor Analysis',
    arc: ['context', 'differentiators', 'capabilities', 'offerings', 'metrics', 'audience', 'pricing'],
    boosts: { differentiators: 4, capabilities: 3, metrics: 2, pricing: 2 },
    copyAngle: 'comparative, sharp, positioning-aware — identify what sets this apart',
  },
  product_research: {
    label: 'Product Research',
    arc: ['core_purpose', 'offerings', 'capabilities', 'technology', 'differentiators', 'pricing', 'metrics'],
    boosts: { offerings: 3, capabilities: 3, technology: 2, pricing: 1 },
    copyAngle: 'feature-specific, technical depth, user-journey framing',
  },
  sales_presentation: {
    label: 'Sales Presentation',
    arc: ['core_purpose', 'capabilities', 'differentiators', 'audience', 'ecosystem', 'metrics'],
    boosts: { capabilities: 3, differentiators: 3, audience: 2, ecosystem: 1 },
    copyAngle: 'confidence, concrete proof, value delivery — written to close deals',
  },
  market_research: {
    label: 'Market Research',
    arc: ['context', 'audience', 'metrics', 'ecosystem', 'differentiators', 'offerings'],
    boosts: { metrics: 4, audience: 3, ecosystem: 2, differentiators: 1 },
    copyAngle: 'data-rich, analytical, segment-aware — written for strategic planning',
  },
};

const DEFAULT_PROFILE = PURPOSE_PROFILES.general;

function getPurposeProfile(purpose) {
  return PURPOSE_PROFILES[purpose] || DEFAULT_PROFILE;
}

// ---------------------------------------------------------------------------
// Topic Descriptors — purely semantic, NO brand/company/domain hardcoding
// ---------------------------------------------------------------------------

const TOPIC_DESCRIPTORS = [
  {
    key: 'hero',
    role: 'opening',
    narrativeOrder: 0,
    label: 'Introduction',
    clusterKeys: ['overview'],
    minClaims: 0,
    required: true,
    maxClaims: 3,
    layout: 'split',
    visualIntent: 'screenshot',
  },
  {
    key: 'context',
    role: 'context',
    narrativeOrder: 10,
    label: 'Context',
    clusterKeys: ['overview', 'differentiators'],
    minClaims: 1,
    required: false,
    maxClaims: 4,
    layout: 'split',
    visualIntent: 'editorial',
  },
  {
    key: 'core_purpose',
    role: 'purpose',
    narrativeOrder: 20,
    label: 'Core Purpose',
    clusterKeys: ['core_offerings', 'overview'],
    minClaims: 1,
    required: false,
    maxClaims: 4,
    layout: 'split',
    visualIntent: 'editorial',
  },
  {
    key: 'offerings',
    role: 'product',
    narrativeOrder: 30,
    label: 'Offerings',
    clusterKeys: ['core_offerings', 'tools_and_features'],
    minClaims: 1,
    required: false,
    maxClaims: 4,
    layout: 'grid',
    visualIntent: 'feature_cards',
  },
  {
    key: 'capabilities',
    role: 'features',
    narrativeOrder: 40,
    label: 'Capabilities',
    clusterKeys: ['tools_and_features'],
    minClaims: 1,
    required: false,
    maxClaims: 4,
    layout: 'grid',
    visualIntent: 'feature_cards',
  },
  {
    key: 'differentiators',
    role: 'differentiation',
    narrativeOrder: 50,
    label: 'Differentiation',
    clusterKeys: ['differentiators'],
    minClaims: 1,
    required: false,
    maxClaims: 4,
    layout: 'split',
    visualIntent: 'editorial',
  },
  {
    key: 'audience',
    role: 'audience',
    narrativeOrder: 55,
    label: 'Audience',
    clusterKeys: ['audience_and_reach'],
    minClaims: 1,
    required: false,
    maxClaims: 4,
    layout: 'split',
    visualIntent: 'editorial',
  },
  {
    key: 'technology',
    role: 'technology',
    narrativeOrder: 60,
    label: 'Technology',
    clusterKeys: ['technology'],
    minClaims: 1,
    required: false,
    maxClaims: 4,
    layout: 'grid',
    visualIntent: 'feature_cards',
  },
  {
    key: 'ecosystem',
    role: 'ecosystem',
    narrativeOrder: 65,
    label: 'Ecosystem',
    clusterKeys: ['ecosystem_partners'],
    minClaims: 1,
    required: false,
    maxClaims: 4,
    layout: 'grid',
    visualIntent: 'feature_cards',
  },
  {
    key: 'metrics',
    role: 'metrics',
    narrativeOrder: 70,
    label: 'Scale & Impact',
    clusterKeys: ['metrics_and_scale'],
    minClaims: 1,
    required: false,
    maxClaims: 6,
    layout: 'center',
    visualIntent: 'metrics_grid',
  },
  {
    key: 'pricing',
    role: 'pricing',
    narrativeOrder: 75,
    label: 'Pricing',
    clusterKeys: ['special_pricing'],
    minClaims: 2,      // pricing still requires at least 2 claims (lower quality risk)
    required: false,
    maxClaims: 4,
    layout: 'grid',
    visualIntent: 'feature_cards',
  },
  {
    key: 'closing',
    role: 'closing',
    narrativeOrder: 100,
    label: 'Summary',
    clusterKeys: ['overview', 'metrics_and_scale', 'differentiators'],
    minClaims: 0,
    required: false,      // NOT always emitted — see isClosingSlideJustified()
    maxClaims: 3,
    layout: 'center',
    visualIntent: 'editorial',
  },
];

// ---------------------------------------------------------------------------
// 4-Layer Claim Usage Registry
// ---------------------------------------------------------------------------

class ClaimUsageRegistry {
  constructor() {
    this._primaryUsed = new Set();
    this._supportUsed = new Set();
    this._textIndex = [];
  }

  index(claim) {
    if (!claim?.id) return;
    const text = typeof claim.claim === 'string' ? claim.claim : '';
    if (text) {
      this._textIndex.push({
        id: claim.id,
        tokens: tokenize(text),
        normalized: normalizeClaimText(text),
        predicate: extractSubjectPredicate(text),
      });
    }
  }

  /**
   * 4-layer duplicate detection:
   * Layer 1 — exact normalized text
   * Layer 2 — 80-char normalized prefix match
   * Layer 3 — Jaccard token overlap > 0.60
   * Layer 4 — same subject-predicate pair (entity + verb)
   */
  isSemanticallyDuplicateOfPrimary(claim) {
    const text = typeof claim?.claim === 'string' ? claim.claim : '';
    if (!text || text.length < 15) return false;

    const normA = normalizeClaimText(text);
    const tokensA = tokenize(text);
    const predA = extractSubjectPredicate(text);

    for (const entry of this._textIndex) {
      if (!this._primaryUsed.has(entry.id)) continue;

      // Layer 1: exact
      if (normA === entry.normalized) return true;

      // Layer 2: prefix
      if (normA.length >= 60 && entry.normalized.length >= 60 &&
          normA.slice(0, 70) === entry.normalized.slice(0, 70)) return true;

      // Layer 3: Jaccard
      if (tokensA.size > 2 && jaccardSimilarity(tokensA, entry.tokens) > 0.60) return true;

      // Layer 4: same subject-predicate
      if (predA && entry.predicate &&
          predA.subject === entry.predicate.subject &&
          predA.predicate === entry.predicate.predicate) return true;
    }
    return false;
  }

  markPrimary(claim) {
    if (claim?.id) this._primaryUsed.add(claim.id);
  }

  markSupport(claim) {
    if (claim?.id) this._supportUsed.add(claim.id);
  }

  isUsedAsPrimary(claim) {
    return claim?.id ? this._primaryUsed.has(claim.id) : false;
  }
}

// ---------------------------------------------------------------------------
// Text utilities
// ---------------------------------------------------------------------------

function normalizeClaimText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lightweight subject-predicate extraction.
 * Returns { subject: string, predicate: string } or null.
 * No LLM required — pure regex heuristics.
 *
 * Examples:
 *   "Zomato operates in 500+ cities" → { subject: "zomato", predicate: "operates" }
 *   "Zomato is present in over 500 cities" → { subject: "zomato", predicate: "present" }
 *   Both are the same insight (same subject + same semantic predicate family).
 */
function extractSubjectPredicate(text) {
  if (!text || text.length < 15) return null;
  const clean = text.trim().replace(/[^\w\s]/g, ' ');
  const words = clean.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 3) return null;

  // Subject: first noun-like word (capitalized or a known org-signal word)
  const subject = words[0].toLowerCase();

  // Predicate: first verb-like word after subject
  // Common verb patterns in factual claims
  const VERBS = /^(is|are|was|were|has|have|had|does|do|provides?|offers?|enables?|delivers?|helps?|builds?|creates?|connects?|serves?|supports?|includes?|allows?|gives?|makes?|uses?|runs?|operates?|covers?|employs?|manages?|processes?|generates?|raised?|raised|launched?|launched|founded?|founded|grew?|grew|acquired?|acquired|partnered?|partnered|integrated?|integrated|expanded?|expanded)$/i;

  let predicate = null;
  for (let i = 1; i < Math.min(words.length, 6); i++) {
    const stem = words[i].toLowerCase().replace(/s$/, '').replace(/ed$/, '').replace(/ing$/, '');
    if (VERBS.test(words[i]) || VERBS.test(stem)) {
      predicate = stem;
      break;
    }
  }

  if (!subject || !predicate) return null;
  return { subject, predicate };
}

// ---------------------------------------------------------------------------
// Singleton quality gate
// ---------------------------------------------------------------------------

/**
 * Determines whether a cluster with exactly 1 claim justifies its own slide.
 * High-quality single claims do. Low-quality fragments don't.
 */
function isSingletonClaimEligibleForOwnSlide(claim) {
  if (!claim) return false;
  const text = (claim.claim || '').trim();

  // Too short to be a real insight
  if (text.length < 40) return false;

  // Must be a non-trivial claim type
  const trivialTypes = new Set(['other', 'navigation', 'meta', 'fragment']);
  if (trivialTypes.has(claim.claim_type)) return false;

  // Must have reasonable confidence (default to 0.85 if omitted in mocks)
  const conf = typeof claim.confidence === 'number' ? claim.confidence : 0.85;
  if (conf < 0.70) return false;

  // Must contain a specific number, named entity signal, or measurable outcome
  const hasSpecificity =
    /\d/.test(text) ||                                    // any number
    /\b[A-Z][a-z]+\b/.test(text) ||                      // proper noun
    /\b(million|billion|thousand|percent|%|users|cities|countries|products|services|partners|clients)\b/i.test(text);

  return hasSpecificity;
}

// ---------------------------------------------------------------------------
// Closing slide eligibility
// ---------------------------------------------------------------------------

/**
 * Determines whether a closing/summary slide is justified.
 * Closing is optional — never added just to round out the deck.
 */
function isClosingSlideJustified(selectedTopics, clusters, registry, prioritizedClaims) {
  const contentSlides = selectedTopics.filter(
    (t) => t.key !== 'hero' && t.key !== 'closing'
  );

  // Need at least 3 content slides for a closing to add value
  if (contentSlides.length < 3) return false;

  // Need at least 2 unused claims that haven't been used as primary elsewhere
  const unusedClaims = prioritizedClaims.filter(
    (c) => !registry.isUsedAsPrimary(c) && (c.claim || '').length >= 25
  );
  if (unusedClaims.length < 2) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Plans a bespoke, evidence-driven slide sequence for any website.
 *
 * @param {Object} subjectProfile - Output from subjectProfile.js
 * @param {Object} insightData    - { prioritizedClaims, clusters } from insightPrioritizer.js
 * @param {string} [purpose]
 * @returns {Array} Slide plan specifications
 */
export function planStoryAndSlides(subjectProfile, insightData, purpose = 'general') {
  const { name } = subjectProfile;
  const { clusters, prioritizedClaims } = insightData;
  const profile = getPurposeProfile(purpose);

  console.log(`[storyPlanner] Purpose: "${purpose}" (${profile.label}) | Claims: ${prioritizedClaims.length} | Clusters: ${clusters.size}`);

  // Build claim registry and index all claims
  const registry = new ClaimUsageRegistry();
  for (const c of prioritizedClaims) registry.index(c);

  // 1. Score every topic by evidence richness + purpose boosts
  const scoredTopics = scoreTopics(TOPIC_DESCRIPTORS, clusters, profile, prioritizedClaims);

  // 2. Select eligible topics (evidence-gated)
  const selectedTopics = selectTopics(scoredTopics, clusters, registry, prioritizedClaims, profile);

  // 3. Apply purpose-aware narrative arc reordering
  const sequenced = applyNarrativeArc(selectedTopics, profile, registry, clusters, prioritizedClaims);

  // 4. Build the final slide plan with evidence-derived titles
  const plan = buildSlidePlan(sequenced, clusters, registry, subjectProfile, purpose, prioritizedClaims, profile);

  console.log(`[storyPlanner] Evidence-driven slide count: ${plan.length} topics selected from ${clusters.size} clusters (purpose: ${purpose})`);
  return plan;
}

// ---------------------------------------------------------------------------
// Topic Scoring
// ---------------------------------------------------------------------------

function scoreTopics(descriptors, clusters, purposeProfile, prioritizedClaims) {
  return descriptors.map((desc) => {
    const allClaims = gatherClaimsForDescriptor(desc, clusters, prioritizedClaims);
    const claimCount = allClaims.length;

    let score = Math.min(claimCount * 10, 80);

    // Bonus for high-confidence claims
    const highConfidence = allClaims.filter((c) => (c.confidence || 0) >= 0.8);
    score += highConfidence.length * 5;

    // Metrics: extra bonus for numeric claims
    if (desc.key === 'metrics') {
      const numericClaims = allClaims.filter(
        (c) => /[\$₹€£]?\d+[\d,]*[KMBTkm]?\+?\s*(?:million|billion|thousand|users|trips|orders|cars|cities|countries|students|%)/i.test(c.claim || '')
      );
      score += numericClaims.length * 8;
    }

    // Purpose-aware boosts (using the canonical map, not domain-specific logic)
    const boost = purposeProfile.boosts[desc.key] || 0;
    score += boost * 10;

    // Hero is always first
    if (desc.key === 'hero') score = 1000;
    // Closing is evaluated separately
    if (desc.key === 'closing') score = 0;

    const isSingleton = claimCount === 1;
    const singletonEligible = isSingleton
      ? isSingletonClaimEligibleForOwnSlide(allClaims[0])
      : true;

    return {
      ...desc,
      evidenceClaims: allClaims,
      evidenceCount: claimCount,
      score,
      eligible: claimCount >= desc.minClaims && (!isSingleton || singletonEligible),
      isSingleton,
      singletonEligible,
    };
  });
}

function gatherClaimsForDescriptor(desc, clusters, prioritizedClaims) {
  const seen = new Set();
  const out = [];
  for (const key of desc.clusterKeys) {
    const bucket = clusters.get(key) || [];
    for (const c of bucket) {
      if (c?.id && !seen.has(c.id)) {
        seen.add(c.id);
        out.push(c);
      }
    }
  }
  // For hero — include top prioritized claims as fallback
  if (out.length === 0 && desc.key === 'hero') {
    prioritizedClaims.slice(0, 3).forEach((c) => {
      if (c?.id && !seen.has(c.id)) { seen.add(c.id); out.push(c); }
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Topic Selection
// ---------------------------------------------------------------------------

function selectTopics(scoredTopics, clusters, registry, prioritizedClaims, purposeProfile) {
  // Filter to eligible topics
  const eligible = scoredTopics.filter((t) => t.eligible);

  // Handle ineligible singleton claims: absorb them into the most related adjacent cluster
  const ineligibleSingletons = scoredTopics.filter(
    (t) => t.isSingleton && !t.singletonEligible && t.evidenceClaims.length > 0
  );

  // For ineligible singletons: find the best related eligible topic and add as support
  for (const orphan of ineligibleSingletons) {
    const bestTarget = eligible.find(
      (t) => t.key !== 'hero' && t.key !== 'closing' &&
        orphan.clusterKeys.some((k) => t.clusterKeys.includes(k))
    );
    if (bestTarget && orphan.evidenceClaims[0]) {
      // Absorb into the target's evidence claims
      const existingIds = new Set(bestTarget.evidenceClaims.map((c) => c.id));
      if (!existingIds.has(orphan.evidenceClaims[0].id)) {
        bestTarget.evidenceClaims.push(orphan.evidenceClaims[0]);
      }
    }
  }

  // Semantic dedup at the topic level: remove topics whose claim sets overlap significantly
  const deduped = deduplicateTopics(eligible);

  // Safety max: 16 slides (never a floor)
  return deduped.slice(0, 16);
}

function deduplicateTopics(topics) {
  const result = [];
  for (const topic of topics) {
    if (topic.key === 'hero' || topic.key === 'closing') {
      result.push(topic);
      continue;
    }
    const isCoveredByPrior = result.some((prior) => {
      if (prior.key === 'hero' || prior.key === 'closing') return false;
      const priorIds = new Set(prior.evidenceClaims.map((c) => c.id));
      const topicIds = new Set(topic.evidenceClaims.map((c) => c.id));
      if (!priorIds.size || !topicIds.size) return false;
      const intersection = [...topicIds].filter((id) => priorIds.has(id)).length;
      const union = new Set([...priorIds, ...topicIds]).size;
      return union > 0 && (intersection / union) > 0.70;
    });
    if (!isCoveredByPrior) result.push(topic);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Narrative Arc Application (Purpose-Driven Ordering)
// ---------------------------------------------------------------------------

/**
 * Reorders selected topics to match the purpose's preferred narrative arc.
 * Topics not in the arc are appended at the end (before closing) by their default narrativeOrder.
 *
 * Additionally: evaluates and conditionally includes the closing slide.
 */
function applyNarrativeArc(topics, purposeProfile, registry, clusters, prioritizedClaims) {
  const hero = topics.filter((t) => t.key === 'hero');
  const closingDescriptor = TOPIC_DESCRIPTORS.find((d) => d.key === 'closing');
  const middle = topics.filter((t) => t.key !== 'hero' && t.key !== 'closing');

  // Reorder middle topics by the purpose's arc preference
  const arc = purposeProfile.arc || [];
  const arcIndexed = middle.sort((a, b) => {
    const ia = arc.indexOf(a.key);
    const ib = arc.indexOf(b.key);
    // If both in arc, sort by arc position
    if (ia !== -1 && ib !== -1) return ia - ib;
    // If only one in arc, arc-listed comes first
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    // Both outside arc: sort by default narrativeOrder
    return a.narrativeOrder - b.narrativeOrder;
  });

  // Determine if closing slide is justified
  // We need to pre-mark some claims to check this accurately
  const closingJustified = isClosingSlideJustified(
    [...hero, ...arcIndexed],
    clusters,
    registry,
    prioritizedClaims
  );

  const closingTopics = closingJustified
    ? [{ ...closingDescriptor, evidenceClaims: gatherClaimsForDescriptor(closingDescriptor, clusters, prioritizedClaims), evidenceCount: 0, eligible: true }]
    : [];

  return [...hero, ...arcIndexed, ...closingTopics];
}

// ---------------------------------------------------------------------------
// Slide Plan Construction
// ---------------------------------------------------------------------------

function buildSlidePlan(sequenced, clusters, registry, profile, purpose, prioritizedClaims, purposeProfile) {
  const plan = [];
  const usedTitleFragments = new Set();

  for (let i = 0; i < sequenced.length; i++) {
    const topic = sequenced[i];

    // Filter out already-used-as-primary claims
    const candidateClaims = (topic.evidenceClaims || []).filter((c) => {
      if (topic.key === 'hero' || topic.key === 'closing') return true;
      return !registry.isSemanticallyDuplicateOfPrimary(c);
    });

    // Skip non-hero/closing slides with no usable candidates
    if (topic.key !== 'hero' && topic.key !== 'closing' && candidateClaims.length === 0) {
      continue;
    }

    const primaryClaim = candidateClaims.find((c) => !registry.isUsedAsPrimary(c));
    const derivedTitle = deriveSlideTitle(topic, primaryClaim, profile, usedTitleFragments);

    const titleKey = derivedTitle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    usedTitleFragments.add(titleKey);

    const kicker = deriveKicker(topic);

    const assignedClaims = candidateClaims.slice(0, topic.maxClaims);
    assignedClaims.forEach((c, idx) => {
      if (idx === 0) registry.markPrimary(c);
      else registry.markSupport(c);
    });

    plan.push({
      slideIndex: plan.length + 1,
      section: mapTopicKeyToSection(topic.key),
      purpose: topic.role,
      suggestedTitle: derivedTitle,
      clusterKey: topic.clusterKeys[0],
      supportingClaims: assignedClaims,
      layoutArchetype: topic.layout,
      visualIntent: topic.visualIntent,
      kicker,
      topicKey: topic.key,
      topicRole: topic.role,         // passed to layoutSelector for intent-based selection
      evidenceCount: candidateClaims.length,
      purposeAngle: purposeProfile.copyAngle,  // passed to contentRewriter for AI polish
    });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Evidence-Derived Title Generation
// ---------------------------------------------------------------------------

function deriveSlideTitle(topic, primaryClaim, profile, usedFragments) {
  const name = profile.name || 'The Platform';

  if (topic.key === 'hero') return name;
  if (topic.key === 'closing') return `${name} at a Glance`;

  if (!primaryClaim) return NEUTRAL_TOPIC_LABELS[topic.key] || topic.label;

  const text = (typeof primaryClaim.claim === 'string' ? primaryClaim.claim : '').trim();
  const extracted = extractInsightTitle(text, topic, usedFragments);
  if (extracted && extracted.length >= 20 && extracted.length <= 72) {
    return extracted;
  }

  return NEUTRAL_TOPIC_LABELS[topic.key] || topic.label;
}

const NEUTRAL_TOPIC_LABELS = {
  context:        'Setting the Stage',
  core_purpose:   'What It Does',
  offerings:      'Core Offerings',
  capabilities:   'Key Capabilities',
  differentiators:'What Makes It Different',
  audience:       'Who It Serves',
  technology:     'Technology & Infrastructure',
  ecosystem:      'Partners & Integrations',
  metrics:        'By the Numbers',
  pricing:        'Plans & Pricing',
  closing:        'Summary',
};

function extractInsightTitle(text, topic, usedFragments) {
  if (!text || text.length < 15) return null;

  let clean = text.replace(/^[\d\s.)\-–•]+/, '').trim();
  const firstSentence = clean.split(/[.!?]/)[0].trim();

  if (/^https?:\/\//.test(firstSentence)) return null;
  if (/^(home|menu|login|sign|cart|checkout|close|toggle|skip)$/i.test(firstSentence)) return null;

  if (firstSentence.length >= 20 && firstSentence.length <= 70) {
    const key = firstSentence.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    if (!usedFragments.has(key)) return firstSentence;
  }

  const short = clean.slice(0, 65).replace(/\s\S*$/, '').trim();
  if (short.length >= 20) {
    const key = short.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
    if (!usedFragments.has(key)) return short;
  }

  return null;
}

function deriveKicker(topic) {
  const MAP = {
    hero:           'OVERVIEW',
    context:        'CONTEXT',
    core_purpose:   'WHAT IT DOES',
    offerings:      'CORE OFFERINGS',
    capabilities:   'KEY CAPABILITIES',
    differentiators:'DIFFERENTIATION',
    audience:       'WHO IT SERVES',
    technology:     'TECHNOLOGY',
    ecosystem:      'ECOSYSTEM',
    metrics:        'BY THE NUMBERS',
    pricing:        'PRICING',
    closing:        'SUMMARY',
  };
  return MAP[topic.key] || topic.label.toUpperCase();
}

function mapTopicKeyToSection(key) {
  const MAP = {
    hero:           'hero',
    context:        'overview',
    core_purpose:   'overview',
    offerings:      'product',
    capabilities:   'features',
    differentiators:'features',
    audience:       'overview',
    technology:     'technology',
    ecosystem:      'services',
    metrics:        'metrics',
    pricing:        'pricing',
    closing:        'cta',
  };
  return MAP[key] || key;
}
