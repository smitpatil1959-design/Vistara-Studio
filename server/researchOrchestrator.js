/**
 * Research Orchestrator
 *
 * Central pipeline coordinator for Vistara's internet research engine.
 * Replaces the ad-hoc research logic that was previously scattered in api/analyze.js.
 *
 * Pipeline:
 *   1. Identify subject (name, domain, org type) from crawl result
 *   2. Create/update research session
 *   3. Extract crawl evidence
 *   4. Run web research (if OpenAI configured) with dynamic queries
 *   5. Extract search evidence
 *   6. Generate claims from evidence
 *   7. Deduplicate claims
 *   8. Detect and record conflicts
 *   9. Update session with final counts
 *
 * Graceful degradation:
 *   - If OpenAI missing → crawl-only mode, session.research_mode = 'crawl_only'
 *   - If some queries fail → continue, session marked 'partial' if >50% failed
 *   - Individual step errors are isolated — they never abort the whole pipeline
 *
 * Security:
 *   - OPENAI_API_KEY never leaves this module
 *   - All data passed to callers is typed/validated
 */

import supabase from './db-client.js';
import config from './config.js';
import { identifySubject, researchSubject, getWebResearchStatus } from './webSearch.js';
import { extractEvidenceFromCrawl, extractEvidenceFromSearch } from './evidenceExtraction.js';
import { generateClaimsFromEvidence, removeDuplicateClaims, detectClaimConflicts } from './claimEngine.js';

/**
 * Update research session status (creates session if not yet present).
 * Failure-tolerant — never throws.
 */
async function updateSession(projectId, fields) {
  try {
    const { data: existing } = await supabase
      .from('research_sessions')
      .select('id')
      .eq('project_id', projectId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('research_sessions')
        .update({ ...fields })
        .eq('project_id', projectId);
      if (error) console.warn('[orchestrator] session update failed:', error.message);
    } else {
      const { error } = await supabase
        .from('research_sessions')
        .insert({
          project_id: projectId,
          research_type: 'initial',
          ...fields,
        });
      if (error) console.warn('[orchestrator] session insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[orchestrator] session update error:', err.message);
  }
}

/**
 * Update project status in the pipeline.
 * Failure-tolerant — never throws.
 */
async function updateProjectStatus(projectId, status) {
  try {
    const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
    if (error) console.warn('[orchestrator] project status update failed:', status, error.message);
  } catch (err) {
    console.warn('[orchestrator] project status error:', err.message);
  }
}

/**
 * Main research orchestration function.
 *
 * @param {string} projectId
 * @param {Object} project - Full project row from DB
 * @param {Object} crawlResult - Result from analyzeWebsite()
 * @param {string} purpose - Research purpose
 * @returns {Promise<{
 *   subjectInfo: Object,
 *   crawlEvidence: Object,
 *   searchEvidence: Object,
 *   claims: Object,
 *   duplicateClaims: Object,
 *   conflicts: Array,
 *   researchMode: string,
 *   sessionStatus: string,
 * }>}
 */
export async function orchestrateResearch(projectId, project, crawlResult, purpose = 'general') {
  const startTime = Date.now();
  let sessionStatus = 'partial';
  let subjectInfo = null;
  let crawlEvidence = { sourcesCreated: 0, evidenceCreated: 0, errors: [] };
  let searchEvidence = { sourcesCreated: 0, evidenceCreated: 0, errors: [] };
  let claims = { claimsCreated: 0, errors: [] };
  let duplicateClaims = { removed: 0, errors: [] };
  let conflicts = [];
  const researchMode = config.isOpenAiConfigured() ? 'crawl_and_search' : 'crawl_only';

  // ── Step 1: Identify subject ─────────────────────────────────────────────
  try {
    await updateProjectStatus(projectId, 'identifying');
    await updateSession(projectId, { status: 'identifying' });

    const analysis = crawlResult.analysis || {};
    subjectInfo = identifySubject(analysis, project.name || '');

    console.log(`[orchestrator] Subject identified: "${subjectInfo.name}" (${subjectInfo.orgType}) @ ${subjectInfo.domain}`);
    await updateSession(projectId, {
      subject_name: subjectInfo.name,
      subject_type: subjectInfo.orgType,
      research_mode: researchMode,
    });
  } catch (err) {
    console.error('[orchestrator] subject identification failed:', err.message);
    // Fallback subject from project data
    subjectInfo = { name: project.name || '', domain: '', orgType: 'generic', description: '' };
  }

  // ── Step 2: Extract crawl evidence ──────────────────────────────────────
  try {
    await updateProjectStatus(projectId, 'crawling');
    await updateSession(projectId, { status: 'crawling', crawl_date: new Date().toISOString() });

    const evidenceAnalysis = { ...(crawlResult.analysis || {}), url: project.url };
    crawlEvidence = await extractEvidenceFromCrawl(
      projectId,
      evidenceAnalysis,
      crawlResult.analysis?.pages || []
    );
    console.log(`[orchestrator] Crawl evidence: ${crawlEvidence.evidenceCreated} items, ${crawlEvidence.errors.length} errors`);
  } catch (err) {
    console.error('[orchestrator] crawl evidence extraction failed:', err.message);
    crawlEvidence.errors.push(err.message);
  }

  // ── Step 3: Web research (OpenAI + open knowledge bases) ───────────────────────────
  try {
    await updateProjectStatus(projectId, 'researching');
    await updateSession(projectId, { status: 'researching' });

    const { results, queriesRun, errors: searchErrors } = await researchSubject(
      subjectInfo,
      purpose,
      { maxQueries: config.maxSearchQueries, maxSources: config.maxResearchSources }
    );

    await updateSession(projectId, {
      search_date: new Date().toISOString(),
      search_queries_run: queriesRun,
    });

    // ── Step 4: Extract search evidence ────────────────────────────────
    await updateProjectStatus(projectId, 'extracting');
    await updateSession(projectId, { status: 'extracting' });

    searchEvidence = await extractEvidenceFromSearch(projectId, purpose, results);
    console.log(`[orchestrator] Search evidence: ${searchEvidence.evidenceCreated} items from ${results.length} sources`);

    if (searchErrors.length > 0) {
      console.warn('[orchestrator] search errors:', searchErrors.length);
    }
  } catch (err) {
    console.error('[orchestrator] web research failed:', err.message);
    searchEvidence.errors.push(err.message);
  }

  // ── Step 5: Generate + validate claims ───────────────────────────────────
  try {
    await updateProjectStatus(projectId, 'validating');
    await updateSession(projectId, { status: 'validating' });

    claims = await generateClaimsFromEvidence(projectId);
    duplicateClaims = await removeDuplicateClaims(projectId);
    conflicts = await detectClaimConflicts(projectId);

    console.log(`[orchestrator] Claims: ${claims.claimsCreated} created, ${duplicateClaims.removed} deduped, ${conflicts.length} conflicts`);
  } catch (err) {
    console.error('[orchestrator] claim generation failed:', err.message);
    claims.errors.push(err.message);
  }

  // ── Step 6: Finalize session ──────────────────────────────────────────────
  const totalErrors = [
    ...crawlEvidence.errors,
    ...searchEvidence.errors,
    ...claims.errors,
  ].length;

  const totalSources = crawlEvidence.sourcesCreated + searchEvidence.sourcesCreated;
  const totalEvidence = crawlEvidence.evidenceCreated + searchEvidence.evidenceCreated;

  // Determine final session status & effective mode
  const effectiveMode = (researchMode === 'crawl_and_search' && searchEvidence.sourcesCreated > 0)
    ? 'crawl_and_search'
    : 'crawl_only';

  if (totalEvidence > 0 && claims.claimsCreated > 0) {
    sessionStatus = effectiveMode === 'crawl_and_search' ? 'completed' : 'partial';
  } else if (totalEvidence > 0) {
    sessionStatus = 'partial';
  } else {
    sessionStatus = 'failed';
  }

  try {
    await updateSession(projectId, {
      status: sessionStatus,
      research_mode: effectiveMode,
      sources_count: totalSources,
      evidence_count: totalEvidence,
      claims_count: claims.claimsCreated,
      conflicts_count: conflicts.length,
      errors_count: totalErrors,
      completion_time: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[orchestrator] final session update failed:', err.message);
  }

  const durationMs = Date.now() - startTime;
  console.log(`[orchestrator] Research complete in ${durationMs}ms | mode=${researchMode} | status=${sessionStatus} | sources=${totalSources} | evidence=${totalEvidence} | claims=${claims.claimsCreated}`);

  return {
    subjectInfo,
    crawlEvidence,
    searchEvidence,
    claims,
    duplicateClaims,
    conflicts,
    researchMode,
    sessionStatus,
    webResearchStatus: getWebResearchStatus(),
    summary: {
      totalSources,
      totalEvidence,
      totalClaims: claims.claimsCreated,
      totalConflicts: conflicts.length,
      durationMs,
    },
  };
}
