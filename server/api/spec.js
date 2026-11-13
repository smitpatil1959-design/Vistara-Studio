import supabase from './db-client.js';
import { buildSpecFromSlides, normalizePresentation, validatePresentation } from '../spec/index.js';
import { defaultMotionSpec, defaultThemeSpec } from '../spec/index.js';
import { ensureDeckAccess, requireProjectOwner } from '../visibility.js';
import { saveDeck } from '../deckStore.js';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

async function loadSlidesOrdered(projectId) {
  const { data, error } = await supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Canonical direction: spec → legacy slide rows (for dashboard/pdf/older views). */
async function projectSpecToRows(spec, projectId) {
  const textRole = (s, role) => {
    const el = s.elements.find((e) => e.type === 'text' && e.content.kind === 'text' && e.content.role === role);
    return el ? el.content.text : null;
  };
  const rows = spec.slides.map((s, i) => {
    const cards = s.elements.filter((e) => e.type === 'card' && e.position.slot === 'card');
    const stats = s.elements.filter((e) => e.type === 'card' && e.position.slot === 'stat');
    const media = s.elements.find((e) => e.type === 'image' && e.content.kind === 'image');
    const kick = s.elements.find((e) => e.type === 'text' && e.content.kind === 'text' && e.content.role === 'kicker');
    return {
      id: s.id,
      project_id: projectId,
      sort_order: (i + 1) * 10,
      type: s.section,
      custom_label: kick ? kick.content.text : s.label,
      title: textRole(s, 'title'),
      subtitle: textRole(s, 'subtitle'),
      body: textRole(s, 'body'),
      bullets: cards.map((c) => (c.content.body ? `${c.content.title} — ${c.content.body}` : c.content.title)),
      stats: stats.map((c) => ({ value: c.content.metric || '', label: c.content.title })),
      image_url: media ? media.content.src : null,
      layout: s.layout,
      animation: s.transition,
      theme_override: null,
    };
  });
  const { data: existing, error: existingError } = await supabase.from('slides').select('id, claim_ids, evidence_ids, source_urls').eq('project_id', projectId);
  if (existingError) throw existingError;
  return rows.map((row, i) => {
    const old = (existing || []).find(s => s.id === row.id);
    const sources = spec.slides[i].sources || [];
    return { ...row, claim_ids: [...new Set([...(old?.claim_ids || []), ...sources.flatMap(source => /^[0-9a-f-]{36}$/i.test(source.claimId || '') ? [source.claimId] : [])])], evidence_ids: old?.evidence_ids || [], source_urls: [...new Set([...(old?.source_urls || []), ...sources.map(source => source.url)])] };
  });
}

async function loadSpecRow(projectId) {
  const { data, error } = await supabase.from('project_specs').select('*').eq('project_id', projectId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertSpec(projectId, spec) {
  const existing = await loadSpecRow(projectId);
  const next = { ...spec, updatedAt: new Date().toISOString() };
  if (existing) {
    const { error } = await supabase.from('project_specs').update({ spec: next, version: (existing.version || 1) + 1, updated_at: new Date().toISOString() }).eq('project_id', projectId);
    if (error) throw error;
    return (existing.version || 1) + 1;
  }
  const { error } = await supabase.from('project_specs').insert({ project_id: projectId, spec: next, version: 1 });
  if (error) throw error;
  return 1;
}

/**
 * The Presentation Specification store.
 *  GET  ?projectId=          → current spec (rebuilds deterministically if missing)
 *  POST { spec }             → validate a document without storing
 *  PUT  { projectId, spec }  → validate + persist as the single source of truth
 */
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { projectId } = req.query;
      if (!projectId) return res.status(400).json({ error: 'projectId required' });
      const access = await ensureDeckAccess(supabase, req, projectId);
      if (!access.allowed) return res.status(404).json({ error: 'This presentation is private — sign in to view it.' });
      const existing = await loadSpecRow(projectId);
      if (existing) return res.status(200).json(existing);

      // build-if-missing: derive canonically from the slide rows
      const [{ data: project }, slides] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        loadSlidesOrdered(projectId),
      ]);
      if (!project) return res.status(404).json({ error: 'Project not found.' });
      if (!slides.length) return res.status(404).json({ error: 'No deck generated yet.' });
      const { data: intake } = await supabase.from('project_intake').select('purpose').eq('project_id', projectId).maybeSingle();
      const spec = buildSpecFromSlides(project, slides, 'generated', intake?.purpose || 'general');
      const version = await upsertSpec(projectId, spec);
      return res.status(200).json({ project_id: projectId, spec, version, updated_at: new Date().toISOString(), built: true });
    }

    if (req.method === 'POST') {
      const { spec } = req.body || {};
      if (!spec) return res.status(400).json({ error: 'spec required' });
      const result = validatePresentation(spec);
      return res.status(result.valid ? 200 : 422).json(result);
    }

    if (req.method === 'PUT') {
      const { projectId, spec, expectedVersion } = req.body || {};
      if (!projectId || !spec) return res.status(400).json({ error: 'projectId and spec required' });
      if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion < 0)) return res.status(400).json({ error: 'Expected version must be a nonnegative integer.' });
      if (!(await requireProjectOwner(supabase, req, projectId))) return res.status(403).json({ error: 'Only the project owner can save decks.' });
      if (!Array.isArray(spec.slides) || !spec.slides.length || spec.slides.length > 200) return res.status(422).json({ valid: false, errors: ['A deck must contain between 1 and 200 slides.'] });

      const normalized = normalizePresentation(spec, { theme: defaultThemeSpec(), motion: defaultMotionSpec() });
      const result = validatePresentation(normalized);
      if (!result.valid) return res.status(422).json(result);
      const rows = await projectSpecToRows(normalized, projectId);
      const version = await saveDeck(supabase, projectId, rows, normalized, false, expectedVersion ?? null);
      return res.status(200).json({ valid: true, errors: [], version });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('spec api error:', err);
    if (err?.code === '40001') return res.status(409).json({ error: 'This presentation changed in another tab. Reload before saving to avoid overwriting newer work.', code: 'VERSION_CONFLICT' });
    if (['PGRST202', '42883'].includes(err?.code)) return res.status(503).json({ error: 'Apply the latest Supabase migration to enable safe deck saves.', code: 'DATABASE_UNINITIALIZED' });
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
