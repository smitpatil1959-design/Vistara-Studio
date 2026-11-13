import supabase from './db-client.js';
import { requireProjectOwner } from '../visibility.js';
import { getVerifiedClaims } from '../claimEngine.js';
import { planPresentation, buildSlidesFromClaims, canonicalizePurpose } from '../presentationPlanner.js';
import { claimPipeline, setPipelineStatus } from '../pipeline.js';
import { saveGeneratedDeck } from '../deckStore.js';

export const maxDuration = 30;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

async function logEvent(project_id, kind) {
  try {
    const { error } = await supabase.from('project_events').insert({ project_id, kind });
    if (error) console.warn('event log failed:', error.message);
  } catch { }
}

function safeMessage(e) {
  const raw = e && typeof e === 'object' ? (e.message || e.code || 'unknown') : 'unknown';
  return String(raw)
    .replace(/sb_secret_[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_\-\.]+/g, '[redacted-token]')
    .replace(/(apikey|authorization|x-api-key|bearer)[^\s]*/gi, '[redacted]')
    .slice(0, 400);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const requestId = `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const projectId = (req.body || {}).projectId;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  let step = 'GENERATION_START';
  let acquired = false;
  let previousStatus = 'completed';
  let committed = false;
  const mark = (s, extra = {}) => console.log(`[${s}]`, JSON.stringify({ requestId, projectId, ...extra }));

  try {
    if (!(await requireProjectOwner(supabase, req, projectId))) {
      return res.status(403).json({ error: 'Only the project owner can generate this project.' });
    }
    mark('GENERATION_START');

    step = 'PROJECT_CHECK';
    const { data: project, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return res.status(503).json({ error: 'DATABASE_UNINITIALIZED', requestId, step, message: 'Supabase tables not initialized.' });
      }
      return res.status(404).json({ error: 'PRESENTATION_GENERATION_FAILED', requestId, step, message: 'Project not found.' });
    }
    if (!project) return res.status(404).json({ error: 'PRESENTATION_GENERATION_FAILED', requestId, step, message: 'Project not found.' });

    // Require crawl data — but NOT understanding (crawl-only mode may lack it)
    step = 'ANALYSIS_CHECK';
    if (!project.analysis || project.analysis.crawlStatus === 'failed' || project.analysis.crawlError) {
      return res.status(422).json({
        error: 'PRESENTATION_GENERATION_FAILED', requestId, step: 'ANALYSIS_CHECK',
        message: 'Run the website research before generating a presentation.',
      });
    }

    previousStatus = project.status === 'generated' ? 'generated' : 'completed';
    acquired = await claimPipeline(supabase, project, 'generating');
    if (!acquired) {
      return res.status(409).json({ error: 'PRESENTATION_GENERATION_FAILED', requestId, step, message: 'A deck is already being generated.' });
    }

    void logEvent(projectId, 'generate_started');

    const { data: intake } = await supabase.from('project_intake').select('*').eq('project_id', projectId).maybeSingle();
    // canonicalizePurpose is the SINGLE normalizer — preserves user intent, maps legacy aliases
    const purpose = canonicalizePurpose(intake?.purpose || 'general');
    mark('PURPOSE_LOAD', { raw: intake?.purpose, canonical: purpose });

    // ── Load verified claims ────────────────────────────────────────────────
    step = 'CLAIMS_LOAD';
    let verifiedClaims;
    try {
      verifiedClaims = await getVerifiedClaims(projectId);
    } catch (claimsError) {
      const msg = safeMessage(claimsError);
      await setPipelineStatus(supabase, projectId, previousStatus);
      if (/PGRST205|42P01|relation .* does not exist|schema/i.test(msg)) {
        return res.status(503).json({ error: 'RESEARCH_SCHEMA_UNAVAILABLE', requestId, step, message: 'Research tables unavailable. Apply the latest supabase/schema.sql migration.' });
      }
      return res.status(503).json({ error: 'RESEARCH_UNAVAILABLE', requestId, step, message: 'Research claims could not be loaded.' });
    }

    if (!verifiedClaims.length) {
      await setPipelineStatus(supabase, projectId, previousStatus);
      return res.status(422).json({ error: 'INSUFFICIENT_EVIDENCE', requestId, step, message: 'No verified claims available. Complete a research pass first.' });
    }
    mark('CLAIMS_LOAD', { count: verifiedClaims.length });

    // ── Plan + build slides ─────────────────────────────────────────────────
    step = 'AI_GENERATION_START';
    await setPipelineStatus(supabase, projectId, 'planning');

    // Recover subject info from research session
    const { data: session } = await supabase.from('research_sessions').select('subject_name, subject_type').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const subjectInfo = {
      name: /^(about(?: us)?|company info|home)$/i.test(session?.subject_name || '') ? new URL(project.url).hostname.replace(/^www\./i, '').split('.')[0].replace(/^./, char => char.toUpperCase()) : session?.subject_name || project.name,
      orgType: session?.subject_type || 'generic',
      domain: '',
      url: project.url,
      description: project.analysis?.description || '',
    };

    const selection = await planPresentation(projectId, subjectInfo, verifiedClaims, purpose, project);
    // Pass purpose explicitly — buildSlidesFromClaims MUST receive it; it does not read project_intake itself
    const built = await buildSlidesFromClaims(selection, verifiedClaims, project, subjectInfo, purpose);

    if (!built.length) {
      await setPipelineStatus(supabase, projectId, previousStatus);
      return res.status(422).json({ error: 'INSUFFICIENT_EVIDENCE', requestId, step, message: 'The available evidence does not support any presentation slides.' });
    }

    mark('AI_GENERATION_SUCCESS', { sections: built.length, claims: verifiedClaims.length, purpose });

    // ── Optional: design-prompt ops ────────────────────────────────────────
    const prompt = (intake?.design_prompt || '').trim();

    // ── Write slides to DB ──────────────────────────────────────────────────
    step = 'SUPABASE_WRITE';
    const inserted = await saveGeneratedDeck(supabase, project, built, purpose, prompt, verifiedClaims);
    committed = true;
    mark('SUPABASE_WRITE', { ok: true, rowsInserted: inserted?.length ?? 0 });

    void logEvent(projectId, 'generated');

    const { data: freshSlides } = await supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true });
    const ordered = freshSlides || inserted;

    // Research mode note for chat
    const researchMode = project.analysis?.research?.mode || 'crawl_only';
    const modeNote = researchMode === 'crawl_and_search'
      ? `grounded in ${verifiedClaims.length} supported research claims from the current research run`
      : `grounded in ${verifiedClaims.length} claims from crawled official pages`;

    try {
      const { error } = await supabase.from('chat_messages').insert({
        project_id: projectId,
        role: 'assistant',
        content: `Presentation ready — ${ordered.length} slides, ${modeNote}. Click any slide to edit it, or ask me to make changes.`,
      });

      if (error) {
        console.warn('[generate] chat message insert failed:', error.message);
      }
    } catch (err) {
      console.warn('[generate] chat message insert exception:', err?.message);
    }

    mark('GENERATION_SUCCESS', { sections: ordered.length, requestId });
    return res.status(200).json({ success: true, requestId, projectId, slides: ordered });

  } catch (err) {
    console.error('[GENERATION_FAILED]', JSON.stringify({ requestId, failedStep: step, message: safeMessage(err) }));
    if (acquired && !committed) {
      try { await setPipelineStatus(supabase, projectId, previousStatus); } catch { }
    }

    const msg = err?.message || '';
    if (/fetch failed|getaddrinfo|enotfound|econnrefused|network/i.test(msg)) {
      return res.status(503).json({ error: 'DATABASE_UNREACHABLE', requestId, step, message: 'Database service unreachable.' });
    }
    if (['PGRST205', '42P01', 'PGRST202', '42883'].includes(err?.code)) {
      return res.status(503).json({ error: 'DATABASE_UNINITIALIZED', requestId, step, message: 'Database tables not initialized.' });
    }
    return res.status(500).json({ error: 'PRESENTATION_GENERATION_FAILED', requestId, step, message: safeMessage(err) });
  }
}
