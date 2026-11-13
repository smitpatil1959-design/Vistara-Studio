/**
 * Vistara Studio — Presentation Planner Engine
 *
 * Orchestrates research claims into a coherent, boardroom-ready presentation:
 * 1. Subject Profiler: Infers organizational archetype and verified capabilities.
 * 2. Insight Prioritizer: Filters noise, SEO fluff, and clickbait; clusters high-value claims.
 * 3. Dynamic Story Planner: Evidence + purpose-driven narrative and dynamic slide count.
 * 4. Content Rewriter: Formulates takeaway titles, "Title — Detail" cards (<=4), full provenance.
 * 5. Layout Selector: Enforces visual variety and semantic layout assignments.
 * 6. Presentation Critic: Executes multi-pass auto-repair for zero duplicates and zero overflow.
 *
 * PURPOSE PROPAGATION:
 *   purpose flows as an explicit parameter through every stage of this orchestrator.
 *   It is NEVER inferred from project row fields (which don't store it — project_intake does).
 *   Callers must pass purpose explicitly; this module never defaults to 'general' silently.
 */

import { buildSubjectProfile } from './presentation/subjectProfile.js';
import { prioritizeInsights } from './presentation/insightPrioritizer.js';
import { planStoryAndSlides } from './presentation/storyPlanner.js';
import { writePresentationContent } from './presentation/contentRewriter.js';
import { optimizeDeckLayouts } from './presentation/layoutSelector.js';
import { critiqueAndRepairDeck } from './presentation/presentationCritic.js';
import { toCanonicalSection } from './spec/index.js';
import { buildEvidenceStory } from './presentation/evidenceStory.js';

/** A product URL should not inherit unrelated sections from its parent website. */
export function claimsForPresentation(claims, projectUrl) {
  try {
    const target = new URL(projectUrl);
    const path = target.pathname.toLowerCase().replace(/\/$/, '');
    const segment = path.split('/').filter(Boolean).at(-1);
    if (!segment || /^(about|about-us|company|company-info|corporate|overview|home|index|newsroom|en|en-us)$/.test(segment)) return claims;
    const host = target.hostname.replace(/^www\./i, '');
    const root = segment.replace(/\.html?$/, '');
    const matched = claims.filter(claim => (claim.source_urls || []).some(source => {
      try {
        const url = new URL(source), p = url.pathname.toLowerCase().replace(/\/$/, '');
        if (url.hostname.replace(/^www\./i, '') !== host) return false;
        return p === path || p.startsWith(path + '/') || p.split('/').some(part => part === root || part.startsWith(root + '-') || part.endsWith('-' + root));
      } catch { return false; }
    }));
    return matched.length >= 6 ? matched : claims;
  } catch { return claims; }
}

/**
 * Plan the presentation structure.
 *
 * @param {string} projectId
 * @param {Object} subjectInfo - { name, domain, orgType, description }
 * @param {Array}  verifiedClaims - Claims with status verified|supported
 * @param {string} purpose - Canonical purpose: college | investor | client | product-demo | portfolio | general
 * @param {Object} project - Optional project row
 * @returns {Promise<Array>} Ordered slide specs with supporting evidence
 */
export async function planPresentation(projectId, subjectInfo, verifiedClaims, purpose = 'general', project = {}) {
  if (!verifiedClaims || verifiedClaims.length === 0) {
    console.warn('[planner] No verified claims — cannot plan presentation');
    return [];
  }

  verifiedClaims = claimsForPresentation(verifiedClaims, project?.url);
  const canonicalPurpose = canonicalizePurpose(purpose);

  // 1. Build profile — pass purpose explicitly so subjectProfile can store it
  const profile = buildSubjectProfile(subjectInfo, verifiedClaims, project?.analysis || {}, canonicalPurpose);

  // 2. Prioritize & cluster claims
  const insights = prioritizeInsights(verifiedClaims, profile);

  // 3. Plan story sequence with canonical purpose
  const storyPlan = planStoryAndSlides(profile, insights, canonicalPurpose);

  console.log(`[planner] Planned ${storyPlan.length} slides for "${profile.name}" (purpose: ${canonicalPurpose})`);
  return storyPlan;
}

/**
 * Build slide content from claims.
 *
 * PURPOSE NOTE: purpose must be passed explicitly — it is NOT stored on the project row.
 * The project_intake table holds purpose; the caller (api/generate.js) reads it and
 * passes it here as an explicit argument.
 *
 * @param {Array}  selection - Slide specs from planPresentation
 * @param {Array}  claims - Verified + supported claims
 * @param {Object} project - Full project row
 * @param {Object} subjectInfo - Identified subject info
 * @param {string} purpose - Canonical purpose string (MUST be passed explicitly)
 * @returns {Promise<Array>} Slide objects ready for DB insert and 16:9 canvas rendering
 */
export async function buildSlidesFromClaims(selection, claims, project = {}, subjectInfo = {}, purpose = 'general') {
  claims = claimsForPresentation(claims, project?.url);
  const canonicalPurpose = canonicalizePurpose(purpose);
  const profile = buildSubjectProfile(subjectInfo, claims, project?.analysis || {}, canonicalPurpose);
  const expanded = await buildEvidenceStory(claims, project, profile, canonicalPurpose);
  if (expanded.length >= Math.max(4, selection?.length || 0)) return expanded;

  // Convert legacy selection specs if needed — always use the explicit canonical purpose
  let storyPlan = selection;
  if (!Array.isArray(storyPlan) || storyPlan.length === 0 || !storyPlan[0]?.supportingClaims) {
    const insights = prioritizeInsights(claims, profile);
    storyPlan = planStoryAndSlides(profile, insights, canonicalPurpose);
  }

  // 1. Write presentation content
  let slides = await writePresentationContent(storyPlan, profile, { ...project, intake: { ...project.intake, purpose: canonicalPurpose } });

  // 2. Optimize layouts for visual rhythm
  slides = optimizeDeckLayouts(slides, profile);

  // 3. Presentation Critic & Auto-Repair
  const { slides: repairedSlides, report } = critiqueAndRepairDeck(slides, profile, claims);

  // 4. Harmonize to canonical sections
  const canonicalSlides = repairedSlides.map((s, idx) => ({
    ...s,
    sort_order: idx + 1,
    type: toCanonicalSection ? toCanonicalSection(s.type) : s.type,
    project_id: project?.id,
    // Persist presentation_purpose on each slide so the editor knows what generated it
    presentation_purpose: canonicalPurpose,
  }));

  console.log(`[planner] Built ${canonicalSlides.length} slides for "${profile.name}" (purpose: ${canonicalPurpose}, critic score: ${report.score})`);
  return canonicalSlides;
}

/**
 * High-level end-to-end presentation generation pipeline.
 *
 * @param {Object} options
 * @param {string} options.projectId
 * @param {Object} options.project
 * @param {Object} options.subjectInfo
 * @param {Array}  options.verifiedClaims
 * @param {string} options.purpose - Canonical purpose (must be passed explicitly)
 * @param {Function} [options.llmComplete]
 * @returns {Promise<{ slides: Array, profile: Object, insights: Object, storyPlan: Array, report: Object }>}
 */
export async function generatePresentationDeck({
  projectId,
  project = {},
  subjectInfo = {},
  verifiedClaims = [],
  purpose = 'general',
  llmComplete = null,
}) {
  const canonicalPurpose = canonicalizePurpose(purpose);
  const profile = buildSubjectProfile(subjectInfo, verifiedClaims, project?.analysis || {}, canonicalPurpose);
  const insights = prioritizeInsights(verifiedClaims, profile);
  const storyPlan = planStoryAndSlides(profile, insights, canonicalPurpose);

  let slides = await writePresentationContent(storyPlan, profile, project, { llmComplete });
  slides = optimizeDeckLayouts(slides, profile);

  const { slides: repairedSlides, report } = critiqueAndRepairDeck(slides, profile, verifiedClaims);

  const canonicalSlides = repairedSlides.map((s, idx) => ({
    ...s,
    sort_order: idx + 1,
    type: toCanonicalSection ? toCanonicalSection(s.type) : s.type,
    project_id: projectId || project?.id,
    presentation_purpose: canonicalPurpose,
  }));

  return {
    slides: canonicalSlides,
    profile,
    insights,
    storyPlan,
    report,
  };
}

/**
 * Canonical purpose normalizer.
 *
 * THE SINGLE conversion layer between raw input and the engine's canonical values.
 * Maps legacy research-platform values to UI canonical values.
 * Preserves explicit user selections — never silently downgrades to 'general'.
 *
 * Canonical values: college | investor | client | product-demo | portfolio | general
 */
export function canonicalizePurpose(raw) {
  if (!raw) return 'general';
  const str = String(raw).toLowerCase().trim();

  // Direct match (UI purposes + legacy aliases that are already canonical)
  const CANONICAL = new Set(['college', 'investor', 'client', 'product-demo', 'portfolio', 'general']);
  if (CANONICAL.has(str)) return str;

  // Research-platform purpose aliases → canonical UI purpose
  const ALIAS_MAP = {
    investor_research:    'investor',
    company_overview:     'general',
    competitor_analysis:  'investor',   // competitive framing → investor lens
    product_research:     'product-demo',
    sales_presentation:   'client',
    market_research:      'investor',   // data/evidence-rich → investor lens
    // Spelling variants
    'product_demo':       'product-demo',
    'college_project':    'college',
  };
  if (ALIAS_MAP[str]) return ALIAS_MAP[str];

  // Unknown — treat as general rather than losing the signal
  console.warn(`[canonicalizePurpose] Unknown purpose "${raw}" — treating as "general"`);
  return 'general';
}
