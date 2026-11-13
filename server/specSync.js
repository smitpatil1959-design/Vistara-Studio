/**
 * Canonical spec sync — lives under server/ (never inside api/ internal dirs; those are excluded from serverless tracing on some hosts).
 * Every content mutation path (generation, AI edits, manual slide edits) funnels
 * through here so project_specs always mirrors the slide rows.
 */

import supabase from './db-client.js';
import { buildSpecFromSlides, validatePresentation, themeSpecFromDeck, motionSpecFromDeck, applyTheme } from './spec/index.js';

export async function syncProjectTheme(projectId, theme) {
  const { data: row, error } = await supabase.from('project_specs').select('*').eq('project_id', projectId).maybeSingle();
  if (error) throw error;
  if (!row) return;
  const now = new Date().toISOString();
  const spec = { ...applyTheme(row.spec, themeSpecFromDeck(theme)), motion: motionSpecFromDeck(theme), updatedAt: now };
  const { error: updateError } = await supabase.from('project_specs').update({ spec, version: row.version + 1, updated_at: now }).eq('project_id', projectId);
  if (updateError) throw updateError;
}

// Legacy edits update the matching content elements. Retain the canonical
// canvas positions, styling and extra elements that cannot fit in slide rows.
function mergeSlide(previous, next) {
  const elements = [...previous.elements];
  const replace = (matches, replacements) => {
    const old = elements.filter(matches);
    const merged = replacements.map((replacement, index) => old[index]
      ? { ...old[index], content: { ...old[index].content, ...replacement.content } }
      : replacement);
    const indices = elements.map((el, index) => matches(el) ? index : -1).filter(index => index >= 0);
    const insertAt = indices[0] ?? elements.length;
    for (let index = indices.length - 1; index >= 0; index--) elements.splice(indices[index], 1);
    elements.splice(insertAt, 0, ...merged);
  };
  for (const role of ['kicker', 'title', 'subtitle', 'body']) {
    const matches = el => el.type === 'text' && el.content.role === role;
    // Only the first text of each role is represented by a legacy row.
    const old = elements.find(matches);
    const replacement = next.elements.find(matches);
    if (old && replacement) elements[elements.indexOf(old)] = { ...old, content: { ...old.content, text: replacement.content.text } };
    else if (replacement) elements.push(replacement);
    else if (old) elements.splice(elements.indexOf(old), 1);
  }
  for (const slot of ['card', 'stat']) {
    const matches = el => el.type === 'card' && el.position.slot === slot;
    replace(matches, next.elements.filter(matches));
  }
  const image = elements.find(el => el.type === 'image');
  const newImage = next.elements.find(el => el.type === 'image');
  if (image && newImage) elements[elements.indexOf(image)] = { ...image, content: { ...image.content, src: newImage.content.src } };
  else if (newImage) elements.push(newImage);
  else if (image) elements.splice(elements.indexOf(image), 1);
  return { ...previous, section: next.section, label: next.label, layout: next.layout, transition: next.transition, elements };
}

export async function rebuildSpec(projectId, source, { themeChanged = false } = {}) {
  const [{ data: project, error: projectError }, { data: slides, error: slidesError }, { data: intake, error: intakeError }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('slides').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
    supabase.from('project_intake').select('purpose').eq('project_id', projectId).maybeSingle(),
  ]);
  if (projectError) throw projectError;
  if (slidesError) throw slidesError;
  if (intakeError) throw intakeError;
  if (!project || !slides) return null;
  if (!slides.length) {
    const { error } = await supabase.from('project_specs').delete().eq('project_id', projectId);
    if (error) throw error;
    return null;
  }

  let spec = buildSpecFromSlides(project, slides, source, intake?.purpose || 'general');
  const { data: existing, error: existingError } = await supabase.from('project_specs').select('version, spec').eq('project_id', projectId).maybeSingle();
  if (existingError) throw existingError;
  if (source === 'generated' && existing?.spec && existing.spec.slides.length === slides.length && slides.every(row => existing.spec.slides.some(slide => slide.id === row.id))) {
    const check = validatePresentation(existing.spec);
    if (!check.valid) throw new Error(`Generated document is invalid: ${check.errors[0]}`);
    return { version: existing.version, slideCount: slides.length };
  }
  if (existing?.spec && ['manual-edit', 'ai-edit'].includes(source)) {
    const previous = existing.spec;
    spec = {
      ...previous, updatedAt: spec.updatedAt,
      theme: themeChanged ? spec.theme : previous.theme,
      motion: themeChanged ? spec.motion : previous.motion,
      slides: spec.slides.map(next => {
        const old = previous.slides.find(slide => slide.id === next.id);
        return old ? mergeSlide(old, next) : next;
      }),
    };
  }
  const check = validatePresentation(spec);
  if (!check.valid) {
    console.error('spec rebuild produced invalid document:', check.errors.slice(0, 3));
    throw new Error(`Spec rebuild failed: ${check.errors.slice(0, 3).join('; ')}`);
  }

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
