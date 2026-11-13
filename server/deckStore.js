import { randomUUID } from 'node:crypto';
import { buildSpecFromSlides, validatePresentation, designPresentation, brandForLegacy, makeElement } from './spec/index.js';
import { exportImageData } from './export/imageData.js';

const KEYS = ['type', 'sort_order', 'title', 'subtitle', 'body', 'bullets', 'stats', 'image_url', 'layout', 'animation', 'theme_override', 'custom_label', 'claim_ids', 'evidence_ids', 'source_urls'];

export function deckRows(projectId, slides) {
  return slides.map((slide, index) => ({
    ...Object.fromEntries(KEYS.filter(key => slide[key] !== undefined).map(key => [key, slide[key]])),
    id: slide.id || randomUUID(), project_id: projectId,
    type: slide.type || 'custom', sort_order: slide.sort_order ?? (index + 1) * 10,
  }));
}

// Slides and the canonical presentation commit together. A validation, insert,
// or schema failure rolls the entire transaction back, preserving the old deck.
export async function saveDeck(db, projectId, slides, spec, generated = false, expectedVersion = null) {
  const check = validatePresentation(spec);
  if (!check.valid) throw new Error(`Invalid presentation: ${check.errors.slice(0, 3).join('; ')}`);
  const { data, error } = await db.rpc('save_project_deck', {
    p_project_id: projectId, p_slides: deckRows(projectId, slides), p_spec: spec, p_generated: generated, p_expected_version: expectedVersion,
  });
  if (error) throw error;
  return data;
}

export async function saveGeneratedDeck(db, project, slides, purpose, designPrompt = '', claims = []) {
  const rows = deckRows(project.id, slides);
  const initial = buildSpecFromSlides(project, rows, 'generated', purpose);
  const brand = { ...(project.analysis?.brandKit || brandForLegacy(project.name, project.url, project.analysis?.visualDna?.primary || project.theme?.accent)), brandName: slides[0]?.title || project.name };
  const canEmbed = async (url) => {
    if (!url) return false;
    try { await exportImageData(url, { projectId: project.id, timeoutMs: 6500 }); return true; }
    catch { return false; }
  };
  const [coverReady, logoReady] = await Promise.all([canEmbed(rows[0]?.image_url), canEmbed(brand.logoUrl)]);
  if (rows[0]?.image_url && !coverReady) {
    rows[0].image_url = null;
    initial.slides[0].elements = initial.slides[0].elements.filter(element => element.content.kind !== 'image');
  }
  if (!logoReady) brand.logoUrl = null;
  const claimMap = new Map(claims.map(claim => [claim.id, claim]));
  initial.slides.forEach((slide, index) => {
    const row = rows[index];
    if (slides[index]?.composition) slide.metadata.storyComposition = slides[index].composition;
    if (slides[index]?.chart) {
      const chart = makeElement('chart');
      chart.content = slides[index].chart;
      slide.elements.push(chart);
    }
    const cited = (row.claim_ids || []).map(id => claimMap.get(id)).filter(Boolean);
    const links = cited.flatMap(claim => (claim.source_urls || []).slice(0, 1).map(url => ({ url, claimId: claim.id, confidence: claim.confidence })));
    if (links.length) slide.sources = [...new Map(links.map(link => [link.url, link])).values()];
    slide.notes = cited.slice(0, 5).map(claim => claim.claim).join('\n\n').slice(0, 3500);
  });
  if ((purpose === 'college' || slides.some(slide => slide.factCards)) && initial.slides.length < 16) {
    const sources = [...new Map(initial.slides.flatMap(slide => slide.sources || []).map(source => [source.url, source])).values()].slice(0, 8);
    if (sources.length) {
      const id = randomUUID();
      const row = { id, type: 'custom', sort_order: rows.length + 1, title: 'Sources and references', custom_label: 'REFERENCES', layout: 'left', animation: 'fade', project_id: project.id, source_urls: sources.map(source => source.url) };
      rows.push(row);
      const reference = buildSpecFromSlides(project, [row], 'generated', purpose).slides[0];
      reference.sources = sources; reference.metadata.referencePage = true; initial.slides.push(reference);
    }
  }
  const kicker = initial.slides[0]?.elements.find(element => element.content.role === 'kicker');
  if (kicker) kicker.content.text = { college: 'COLLEGE PROJECT', investor: 'INVESTOR BRIEFING', investor_research: 'INVESTOR RESEARCH', 'product-demo': 'PRODUCT DEMO' }[purpose] || kicker.content.text;
  const mood = /\b(dark|cinematic|contrast)\b/i.test(designPrompt) ? 'contrast' : /\b(editorial|serif)\b/i.test(designPrompt) ? 'editorial' : /\b(soft|pastel|warm paper)\b/i.test(designPrompt) ? 'soft' : 'brand';
  const spec = designPresentation(initial, brand, mood);
  spec.name = brand.brandName;
  await saveDeck(db, project.id, rows, spec, true);
  return rows;
}
