/**
 * Canonical spec sync — lives under server/ (never inside api/ internal dirs; those are excluded from serverless tracing on some hosts).
 * Every content mutation path (generation, AI edits, manual slide edits) funnels
 * through here so project_specs always mirrors the slide rows.
 */

import supabase from './db-client.js';
import { buildSpecFromSlides, validatePresentation } from '../server/spec/index.js';

export async function rebuildSpec(projectId, source) {
  const [{ data: project, error: projectError }, { data: slides, error: slidesError }, { data: intake, error: intakeError }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
    supabase.from('project_intake').select('purpose').eq('project_id', projectId).maybeSingle(),
  ]);
  if (projectError) throw projectError;
  if (slidesError) throw slidesError;
  if (intakeError) throw intakeError;
  if (!project || !slides || slides.length === 0) return null;

  const spec = buildSpecFromSlides(project, slides, source, intake?.purpose || 'general');
  const check = validatePresentation(spec);
  if (!check.valid) {
    console.error('spec rebuild produced invalid document:', check.errors.slice(0, 3));
    return null;
  }

  const { data: existing, error: existingError } = await supabase.from('project_specs').select('version').eq('project_id', projectId).maybeSingle();
  if (existingError) throw existingError;
  const version = existing ? (existing.version || 1) + 1 : 1;
  if (existing) {
    const { error } = await supabase.from('project_specs').update({ spec, version, updated_at: new Date().toISOString() }).eq('project_id', projectId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('project_specs').insert({ project_id: projectId, spec, version });
    if (error) throw error;
  }
  return { version, slideCount: spec.slides.length };
}
