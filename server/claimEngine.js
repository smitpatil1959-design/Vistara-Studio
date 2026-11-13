/**
 * Claim Validation Engine
 *
 * Extracts, validates, and ranks claims from evidence.
 * Never allows AI to invent facts — all claims must be grounded in evidence.
 *
 * Status taxonomy:
 *   VERIFIED    — strong authoritative evidence (official source + confirmed)
 *   SUPPORTED   — reliable evidence but not fully authoritative
 *   INFERRED    — reasonable inference; clearly distinguished from facts
 *   CONFLICTING — two credible sources disagree; neither preferred silently
 *   REJECTED    — insufficient/unreliable evidence
 *
 * Pipeline:
 *   1. Extract candidate claims from evidence
 *   2. Validate each claim against evidence quality
 *   3. Assign confidence scores
 *   4. Detect conflicts → write them back to DB as CONFLICTING
 *   5. Store verified claims
 */

import supabase from './db-client.js';
import { isHighQualityContent, cleanExtractedText } from './presentation/extractionQuality.js';

/** Source type authority weights */
const SOURCE_AUTHORITY = {
  official: 1.0,
  official_documentation: 0.95,
  official_newsroom: 0.9,
  government: 0.88,
  industry: 0.7,
  news: 0.65,
  third_party: 0.5,
};

/**
 * Generate claims from evidence for a project.
 * @param {string} projectId
 * @returns {Promise<{ claimsCreated: number, errors: string[] }>}
 */
export async function generateClaimsFromEvidence(projectId, sessionId) {
  const results = { claimsCreated: 0, errors: [] };

  try {
    const { data: evidence, error: fetchErr } = await supabase
      .from('evidence')
      .select('*, sources(url, source_type, hierarchy_score, publication_date)')
      .eq('project_id', projectId).eq('research_session_id', sessionId);

    if (fetchErr) {
      results.errors.push(`Failed to fetch evidence: ${fetchErr.message}`);
      throw fetchErr;
    }

    if (!evidence || evidence.length === 0) {
      console.log(`[claims] No evidence found for project ${projectId}`);
      return results;
    }

    // Group by claim type + semantic key (not just raw normalized text)
    const claimGroups = groupEvidenceByClaims(evidence);

    const rows = [];
    for (const [, items] of claimGroups) {
      try {
        // Pick the best representative text from the group
        const representativeText = pickRepresentativeText(items);
        if (!representativeText || !isHighQualityContent(representativeText)) continue;

        const claim = { ...createClaimFromEvidence(projectId, representativeText, items), research_session_id: sessionId };
        rows.push(claim);
      } catch (err) {
        results.errors.push(`Claim creation: ${err.message}`);
      }
    }
    for (let offset = 0; offset < rows.length; offset += 40) {
      const batch = rows.slice(offset, offset + 40);
      const { error } = await supabase.from('claims').insert(batch);
      if (error) results.errors.push(`Claim insert: ${error.message}`);
      else results.claimsCreated += batch.length;
    }
  } catch (err) {
    results.errors.push(`Evidence processing failed: ${err.message}`);
    console.error('[generateClaimsFromEvidence]', err);
  }

  return results;
}

/**
 * Group evidence into claim candidates.
 * Groups by (claim_type, source_url) rather than raw text to avoid over-grouping.
 */
function groupEvidenceByClaims(evidence) {
  const groups = new Map();

  for (const item of evidence) {
    const raw = typeof item.extracted_text === 'string' ? item.extracted_text : '';
    const text = cleanExtractedText(raw);
    if (!text || !isHighQualityContent(text)) continue;

    // Similar openings can report different values, periods or conditions.
    // Merge only the same statement, preserving currency and punctuation.
    const key = `${item.claim_type}::${normalizeForDedup(text)}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...item, extracted_text: text });
  }

  return groups;
}

/**
 * Pick the best representative text from a group of evidence items.
 * Prefers longer, higher-confidence items from authoritative sources.
 */
function pickRepresentativeText(items) {
  const validItems = (items || []).filter((item) => {
    const txt = typeof item?.extracted_text === 'string' ? item.extracted_text.trim() : '';
    return txt.length > 0 && isHighQualityContent(txt);
  });

  if (validItems.length === 0) return '';

  const sorted = [...validItems].sort((a, b) => {
    const scoreA = (a.confidence ?? 0.5) + getSourceScore(a);
    const scoreB = (b.confidence ?? 0.5) + getSourceScore(b);
    return scoreB - scoreA;
  });

  const best = sorted[0];
  return typeof best?.extracted_text === 'string' ? cleanExtractedText(best.extracted_text).slice(0, 500) : '';
}

function getSourceScore(evidenceItem) {
  const sourceType = evidenceItem?.sources?.source_type || 'third_party';
  return SOURCE_AUTHORITY[sourceType] ?? 0.5;
}

/**
 * Create a claim record from a group of evidence items
 */
function createClaimFromEvidence(projectId, claimText, evidenceItems) {
  const claimType = getMostCommonType(evidenceItems);
  const status = determineClaimStatus(evidenceItems);
  const confidence = calculateConfidence(evidenceItems, status);
  const sourceUrls = [...new Set(evidenceItems.map(e => e.sources?.url).filter(Boolean))];

  return {
    project_id: projectId,
    claim: claimText.slice(0, 1000),
    value: null,
    claim_type: claimType,
    status,
    evidence_ids: evidenceItems.map(e => e.id).filter(Boolean),
    source_urls: sourceUrls,
    confidence,
    basis: status === 'inferred' ? 'observation' : 'fact',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function getMostCommonType(items) {
  const counts = {};
  for (const item of items) counts[item.claim_type] = (counts[item.claim_type] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'other';
}

/**
 * Determine claim status based on evidence quality and source authority.
 *
 * VERIFIED:  Multiple authoritative sources, or one direct official source with high confidence
 * SUPPORTED: One reliable source (official/news), or multiple lower-confidence sources
 * INFERRED:  Only low-confidence or third-party sources
 */
function determineClaimStatus(items) {
  if (!items || items.length === 0) return 'inferred';

  const uniqueSources = new Set(items.map(e => e.source_id));
  const hasOfficial = items.some(e => ['official', 'official_documentation', 'official_newsroom'].includes(e.sources?.source_type));
  const hasGov = items.some(e => e.sources?.source_type === 'government');
  const avgConfidence = items.reduce((sum, e) => sum + (e.confidence ?? 0.5), 0) / items.length;

  // Verified: official source with high confidence OR multiple independent sources
  if (hasOfficial && avgConfidence >= 0.9) return 'verified';
  if (hasGov && avgConfidence >= 0.85) return 'verified';
  if (uniqueSources.size >= 3 && avgConfidence >= 0.7) return 'verified';

  // Supported: official OR news source, OR multiple sources with decent confidence
  if (hasOfficial) return 'supported';
  if (uniqueSources.size >= 2 && avgConfidence >= 0.6) return 'supported';
  const hasReputableSource = items.some(e => ['news', 'industry'].includes(e.sources?.source_type));
  if (hasReputableSource && avgConfidence >= 0.65) return 'supported';

  return 'inferred';
}

function calculateConfidence(items, status) {
  if (!items || items.length === 0) return 0.3;

  const avgEvidence = items.reduce((sum, e) => sum + (e.confidence ?? 0.5), 0) / items.length;
  const statusBonus = { verified: 0.15, supported: 0.08, inferred: 0, conflicting: -0.1 }[status] || 0;
  const uniqueSources = new Set(items.map(e => e.source_id));
  const sourceBonus = Math.min(0.12, (uniqueSources.size - 1) * 0.04);

  return Math.max(0.1, Math.min(1.0, Math.round((avgEvidence + statusBonus + sourceBonus) * 100) / 100));
}

/**
 * Detect conflicting claims and write CONFLICTING status to DB.
 * When two claims of the same type contain meaningfully different assertions,
 * and both come from credible sources, mark the lower-confidence one as CONFLICTING.
 *
 * @param {string} projectId
 * @returns {Promise<Array>} Conflict records
 */
export async function detectClaimConflicts(projectId, sessionId) {
  try {
    const { data: claims, error } = await supabase
      .from('claims')
      .select('*')
      .eq('project_id', projectId)
      .eq('research_session_id', sessionId)
      .in('status', ['verified', 'supported']);

    if (error || !claims || claims.length < 2) return [];

    const conflicts = [];

    // Group by claim_type and look for semantic contradictions
    const byType = {};
    for (const c of claims) {
      if (!byType[c.claim_type]) byType[c.claim_type] = [];
      byType[c.claim_type].push(c);
    }

    for (const [, group] of Object.entries(byType)) {
      if (group.length < 2) continue;

      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const c1 = group[i];
          const c2 = group[j];

          if (areContradictory(c1.claim, c2.claim)) {
            conflicts.push({
              claim1_id: c1.id,
              claim2_id: c2.id,
              claim1_text: c1.claim,
              claim2_text: c2.claim,
              conflictType: 'semantic_contradiction',
            });

            // Mark lower-confidence claim as CONFLICTING
            const [lower, higher] = c1.confidence >= c2.confidence ? [c2, c1] : [c1, c2];
            const { error: updateErr } = await supabase
              .from('claims')
              .update({ status: 'conflicting', updated_at: new Date().toISOString() })
              .eq('id', lower.id);
            if (updateErr) console.warn('[conflicts] update failed:', updateErr.message);

            // Keep the higher-confidence one — prefer newer source if confidence tied
            void higher; // intentionally kept as-is
          }
        }
      }
    }

    return conflicts;
  } catch (err) {
    console.error('[detectClaimConflicts]', err);
    return [];
  }
}

/**
 * Check if two claim texts are contradictory (not just different, but conflicting).
 * Avoids marking "Zomato delivers food" and "Zomato is a SaaS" as contradictions —
 * those are complementary. Looks for genuine factual conflicts.
 */
export function areContradictory(a, b) {
  if (!a || !b) return false;
  const normalize = text => text.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/[^a-z0-9.\s]/g, '').replace(/\s+/g, ' ').trim();
  const na = normalize(a);
  const nb = normalize(b);

  // Exact match — duplicate, not conflict
  if (na === nb) return false;

  // Very short texts — not enough signal
  if (na.length < 15 || nb.length < 15) return false;

  // Numeric contradictions: both mention a number but different numbers for same entity
  const numA = na.match(/\b\d+(?:\.\d+)?\b/g) || [];
  const numB = nb.match(/\b\d+(?:\.\d+)?\b/g) || [];
  if (numA.length > 0 && numB.length > 0) {
    // Normalize numbers (remove commas)
    const setA = new Set(numA.map(n => n.replace(/,/g, '')));
    const setB = new Set(numB.map(n => n.replace(/,/g, '')));
    // Different metrics (users vs cities, revenue vs funding) are compatible.
    // Only compare quantities in the same assertion, including its date/unit.
    const skeleton = text => text.replace(/\b\d+(?:\.\d+)?\b/g, '#');
    if (skeleton(na) !== skeleton(nb)) return false;
    const hasOverlap = [...setA].some(n => setB.has(n));
    if (!hasOverlap && setA.size > 0 && setB.size > 0) return true;
  }

  return false;
}

/**
 * Get verified and supported claims for presentation generation.
 * @param {string} projectId
 * @param {string|null} claimType - Optional filter
 * @returns {Promise<Array>}
 */
export async function getVerifiedClaims(projectId, claimType = null) {
  try {
    const { data: session, error: sessionError } = await supabase.from('research_sessions').select('id, status').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session || !['completed', 'partial'].includes(session.status)) return [];
    const sessionId = session.id;

    let query = supabase
      .from('claims')
      .select('*')
      .eq('project_id', projectId)
      .eq('research_session_id', sessionId)
      .in('status', ['verified', 'supported'])
      .order('confidence', { ascending: false })
      .limit(350);

    if (claimType) query = query.eq('claim_type', claimType);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[getVerifiedClaims]', err);
    throw err;
  }
}

/**
 * Remove exact duplicate claims, keeping highest-confidence copy.
 * @param {string} projectId
 * @returns {Promise<{ removed: number, errors: string[] }>}
 */
export async function removeDuplicateClaims(projectId, sessionId) {
  const results = { removed: 0, errors: [] };

  try {
    const { data: claims, error } = await supabase.from('claims').select('*').eq('project_id', projectId).eq('research_session_id', sessionId);
    if (error) { results.errors.push(error.message); return results; }

    const groups = new Map();
    for (const claim of (claims || [])) {
      const key = `${claim.claim_type}::${normalizeForDedup(claim.claim)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(claim);
    }

    for (const [, group] of groups) {
      if (group.length <= 1) continue;
      group.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      for (const dup of group.slice(1)) {
        const { error } = await supabase.from('claims').delete().eq('id', dup.id);
        if (error) results.errors.push(`Delete duplicate: ${error.message}`);
        else results.removed++;
      }
    }
  } catch (err) {
    results.errors.push(`Duplicate removal: ${err.message}`);
  }

  return results;
}

function normalizeForDedup(text) {
  if (typeof text !== 'string') return '';
  return text.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}
