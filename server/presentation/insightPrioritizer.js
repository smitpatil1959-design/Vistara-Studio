/**
 * Vistara Studio — Presentation Insight Prioritizer v2
 *
 * Cleans, filters, scores, and clusters verified claims.
 * v2 improvements:
 *   - 4-layer semantic dedup WITHIN each cluster (exact / normalized / Jaccard / entity-predicate)
 *   - Exposes cluster richness for story planner
 *   - Strict claim-quality gating before clustering
 *
 * Domain-agnostic: Operates purely on factual evidence semantics.
 */

import { cleanExtractedText, isHighQualityContent } from './extractionQuality.js';
import { areTextsSubstantiallyDuplicate, tokenize, jaccardSimilarity } from './presentationCritic.js';

export { tokenize, jaccardSimilarity };

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'are', 'was', 'were',
  'will', 'our', 'your', 'about', 'more', 'their', 'such', 'into', 'also', 'than',
  'its', 'can', 'all', 'has', 'been', 'but', 'not', 'you', 'any', 'they', 'which',
]);

/**
 * Filter and score verified claims, clustering them into narrative themes.
 *
 * @param {Array} rawClaims
 * @param {Object} subjectProfile
 * @returns {{ prioritizedClaims: Array, clusters: Map<string,Array> }}
 */
export function prioritizeInsights(rawClaims = [], subjectProfile = {}) {
  if (!Array.isArray(rawClaims) || rawClaims.length === 0) {
    return { prioritizedClaims: [], clusters: new Map() };
  }

  // 1. Clean & gate through extraction quality filter
  const cleanClaims = [];
  const seenNorm = new Set();

  for (const c of rawClaims) {
    const rawText = typeof c.claim === 'string' ? c.claim : '';
    const text = cleanExtractedText(rawText);
    if (!text || !isHighQualityContent(text)) continue;

    const norm = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').slice(0, 80);
    if (seenNorm.has(norm)) continue;
    seenNorm.add(norm);

    cleanClaims.push({ ...c, claim: text });
  }

  // 2. Score claims
  const scoredClaims = cleanClaims.map((claim) => ({
    ...claim,
    score: scoreClaim(claim, subjectProfile),
  }));
  scoredClaims.sort((a, b) => b.score - a.score);

  // 3. Cluster into themes
  const clusters = clusterClaimsByTheme(scoredClaims, subjectProfile);

  // 4. 4-layer semantic dedup WITHIN each cluster
  for (const [key, bucket] of clusters) {
    clusters.set(key, semanticDedupWithinCluster(bucket));
  }

  return {
    prioritizedClaims: scoredClaims,
    clusters,
  };
}

function scoreClaim(claim, subjectProfile) {
  let score = (claim.confidence ?? 0.7) * 40;

  const text = (claim.claim || '').toLowerCase();
  const name = (subjectProfile.name || '').toLowerCase();

  if (name && text.includes(name)) score += 15;

  if (/[\$₹€£]?\d+[\d,]*[KMBTkm]?\+?\s*(?:million|billion|thousand|users|trips|orders|cars|vehicles|cities|countries|students|patients|clients|%)/i.test(text)) {
    score += 25;
  }

  const typeBoosts = {
    product: 20, feature: 18, service: 18, differentiator: 22,
    metric: 24, technology: 16, company_description: 14, audience: 14,
    partnership: 16, pricing: subjectProfile.supportedTopics?.pricing ? 15 : -40, other: 0,
  };

  score += typeBoosts[claim.claim_type] || 5;
  if (text.length > 350) score -= 12;
  if (text.length < 35 && !/\d/.test(text)) score -= 8;

  return Math.round(score);
}

function clusterClaimsByTheme(scoredClaims, subjectProfile) {
  const clusters = new Map([
    ['overview', []],
    ['core_offerings', []],
    ['tools_and_features', []],
    ['audience_and_reach', []],
    ['metrics_and_scale', []],
    ['differentiators', []],
    ['technology', []],
    ['ecosystem_partners', []],
    ['special_pricing', []],
  ]);

  const usedClaimIds = new Set();

  for (const c of scoredClaims) {
    if (usedClaimIds.has(c.id)) continue;
    const type = c.claim_type;
    const txt = (c.claim || '').toLowerCase();

    if (type === 'metric' || type === 'stats' ||
        /[\$₹€£]?\d+[\d,]*[KMBTkm]?\+?\s*(?:million|billion|thousand|users|trips|orders|cars|vehicles|cities|countries|students|patients|%)/i.test(txt)) {
      clusters.get('metrics_and_scale').push(c);
    } else if (type === 'pricing' && subjectProfile.supportedTopics?.pricing) {
      clusters.get('special_pricing').push(c);
    } else if (type === 'differentiator' || type === 'competitor') {
      clusters.get('differentiators').push(c);
    } else if (type === 'technology' || type === 'security') {
      clusters.get('technology').push(c);
    } else if (type === 'partnership' || type === 'integration' || type === 'partnerships' || type === 'integrations') {
      clusters.get('ecosystem_partners').push(c);
    } else if (type === 'feature' || type === 'key_feature' || type === 'service') {
      clusters.get('tools_and_features').push(c);
    } else if (type === 'product' || type === 'core_product' || type === 'business_model') {
      clusters.get('core_offerings').push(c);
    } else if (type === 'audience' || type === 'customer' || type === 'location') {
      clusters.get('audience_and_reach').push(c);
    } else {
      clusters.get('overview').push(c);
    }
    usedClaimIds.add(c.id);
  }

  return clusters;
}

/**
 * 4-layer semantic deduplication within a single cluster bucket.
 * Claims are already sorted descending by score — lower-scored near-duplicates are dropped.
 *
 * Layer 1 — exact normalized text
 * Layer 2 — 80-char normalized prefix
 * Layer 3 — Jaccard token similarity > 0.62
 * Layer 4 — same subject-predicate pair (entity + verb)
 */
function semanticDedupWithinCluster(claims) {
  if (!claims || claims.length <= 1) return claims;

  const kept = [];

  for (const candidate of claims) {
    const isDup = kept.some((k) => areTextsSubstantiallyDuplicate(candidate.claim || '', k.claim || ''));
    if (!isDup) {
      kept.push(candidate);
    }
  }

  return kept;
}
