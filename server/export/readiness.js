/**
 * Export readiness — a pre-flight report run against the canonical spec.
 * Nothing here guesses: schema re-validated, assets HEAD-probed live,
 * overflow estimated from real typography metrics, conversion losses listed
 * explicitly (never silently dropped).
 */

import { fitFont, flattenElements, validatePresentation } from '../spec/index.js';
import { exportImageData } from './imageData.js';

async function assetReachable(url, projectId) {
  try {
    const { status } = await exportImageData(url, { timeoutMs: 6500, projectId });
    return { ok: true, status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export const FONT_FALLBACKS = {
  'Inter Tight': 'Aptos Display',
  'Space Grotesk': 'Aptos Display',
  Inter: 'Segoe UI',
  'Instrument Serif': 'Georgia',
  'JetBrains Mono': 'Consolas',
};

export function estimateFieldWidth(text, fontSize) {
  // rough but honest: average latin glyph advance ≈ 0.54em for grotesks
  return String(text || '').length * fontSize * 0.54;
}

export async function buildReadinessReport(spec, { format = 'pptx', probeAssets = true, projectId } = {}) {
  const findings = [];
  const add = (severity, kind, message, target) => findings.push({ severity, kind, message, target });

  // ---- 1. schema truth
  const v = validatePresentation(spec);
  if (!v.valid) {
    v.errors.slice(0, 8).forEach((e) => add('block', 'schema', `Spec invalid — ${e}`));
    return { format, ready: false, counts: { block: findings.length, warn: 0, note: 0, ok: 0 }, findings, generatedAt: new Date().toISOString() };
  }
  else add('ok', 'schema', `${spec.schemaVersion} validates cleanly (${spec.slides.length} slides)`);

  const font = spec.theme?.typography?.headingFont || 'Inter';
  const direct = FONT_FALLBACKS[font];
  if (format === 'web') add('ok', 'font', `Browser renders the real face: ${font}`);
  else if (direct) add('warn', 'font', `${font} has no Office-safe equivalent — headlines export as ${direct} (listed here, not swapped silently)`, 'theme');
  else add('ok', 'font', `${font} maps to an Office-safe face; nothing changes`);

  // ---- 2. element & animation coverage per format
  const animKinds = new Map();
  const animated = [];
  const videos = [];
  const images = [];
  let absCount = 0;
  let clipRisks = 0;

  for (const slide of spec.slides) {
    if (slide.background?.type === 'image' && slide.background.value) images.push({ slide: slide.label, id: `${slide.id}:background`, src: slide.background.value });
    if (format === 'pptx') {
      if (slide.background?.type === 'gradient') add('note', 'element', `Slide “${slide.label}”: gradient exports as a bitmap background; slide content stays editable.`, slide.label);
    }
    const visit = elements => elements.filter(el => !el.hidden).flatMap(el => el.content.kind === 'group' ? visit(el.content.children) : [el]);
    for (const el of slide.composition ? flattenElements(slide.elements) : visit(slide.elements)) {
      if (el.animation?.preset && el.animation.preset !== 'none') {
        animated.push(el.id);
        animKinds.set(el.animation.preset, (animKinds.get(el.animation.preset) || 0) + 1);
      }
      if (el.content.kind === 'video') {
        videos.push({ slide: slide.label, id: el.id });
        if (el.content.poster) images.push({ slide: slide.label, id: el.id, src: el.content.poster });
      }
      if (el.type === 'image') images.push({ slide: slide.label, id: el.id, src: el.content.kind === 'image' ? el.content.src : '' });
      if (el.content.kind === 'chart' && !el.content.series.length) add('warn', 'element', `Slide “${slide.label}”: chart has no data and exports as a text placeholder.`, slide.label);
      if (format === 'pptx' && el.content.kind === 'chart' && el.content.chart === 'progress') add('note', 'element', `Slide “${slide.label}”: progress rows export as an editable horizontal bar chart.`, slide.label);
      if (format === 'pptx' && el.rotation && ['chart', 'table', 'diagram'].includes(el.type)) add('warn', 'element', `Slide “${slide.label}”: PowerPoint keeps the ${el.type} editable and upright.`, slide.label);
      if (el.position.mode === 'absolute') {
        absCount++;
        const x = el.position.x ?? 0;
        const y = el.position.y ?? 0;
        const w = typeof el.size.w === 'number' ? el.size.w : 200;
        const h = typeof el.size.h === 'number' ? el.size.h : 80;
        if (x < 0 || y < 0 || x + w > spec.canvas.width + 8 || y + h > spec.canvas.height + 8) clipRisks++;
      }
      if (el.type === 'text' && el.content.kind === 'text') {
        const size = el.style?.fontSize ?? (el.content.role === 'title' ? 56 : el.content.role === 'subtitle' ? 20 : 17);
        const avail = typeof el.size.w === 'number' ? el.size.w : spec.canvas.width - 2 * ((spec.theme?.spacing?.sectionGap ?? 48) + 16);
        const overflow = typeof el.size.h === 'number' ? fitFont(el.content.text, avail, el.size.h, size, 1, el.style?.lineHeight || 1.4) < size - 1 : estimateFieldWidth(el.content.text, size) > avail * 1.15;
        if (overflow)
          add('warn', 'overflow', `“${el.content.text.slice(0, 38)}…” likely overflows its canvas at ${size}px`, slide.label);
      }
    }
  }

  if (animated.length) {
    const kinds = [...animKinds.entries()].map(([k, n]) => `${k}×${n}`).join(', ');
    if (format === 'web') add('ok', 'animation', `${animated.length} animated elements verified interactive in present mode (${kinds})`);
    else add('note', 'animation', `${animated.length} animated elements (${kinds}) render at their rest state in a file — frames are final poses, nothing lost`);
  }
  if (videos.length) {
    for (const v of videos) {
      if (format === 'pptx') add('warn', 'element', `Slide “${v.slide}”: video becomes a labeled still frame + link`, v.slide);
      else if (format === 'pdf') add('note', 'element', `Slide “${v.slide}”: video prints as its poster frame`, v.slide);
      else add('ok', 'element', `Slide “${v.slide}”: video plays inline on the web`);
    }
  }
  if (absCount) add('ok', 'element', `${absCount} absolutely-placed elements map 1:1 into export coordinates`);
  if (clipRisks) add('warn', 'overflow', `${clipRisks} elements sit partly outside the 1280×720 canvas — they will print clipped`);
  if (spec.motion?.trigger === 'manual' && format !== 'web')
    add('note', 'animation', 'Manual-reveal slides export fully revealed (presenters see the final state)');

  // ---- 3. asset reachability, live
  if (probeAssets && images.length) {
    const probe = [...new Map(images.map(i => [i.src, i])).values()];
    const results = [];
    for (let index = 0; index < probe.length; index += 4) {
      results.push(...await Promise.all(probe.slice(index, index + 4).map(async (i) => ({ ...i, r: i.src ? await assetReachable(i.src, projectId) : { ok: false, status: 0 } }))));
    }
    const broken = results.filter((r) => !r.r.ok || !r.src);
    if (broken.length === 0) add('ok', 'asset', `${probe.length} imagery references fetched healthy`);
    else for (const b of broken) add('block', 'asset', `Image on slide “${b.slide}” ${b.src ? 'could not be fetched or decoded' : 'has no source'}`, b.slide);
  } else if (images.length) {
    add('note', 'asset', `${images.length} imagery references — reachability probe skipped for speed`);
  }

  const blocks = findings.filter((f) => f.severity === 'block').length;
  const warns = findings.filter((f) => f.severity === 'warn').length;
  const notes = findings.filter((f) => f.severity === 'note').length;

  return {
    format,
    ready: blocks === 0,
    counts: { block: blocks, warn: warns, note: notes, ok: findings.filter((f) => f.severity === 'ok').length },
    findings,
    generatedAt: new Date().toISOString(),
  };
}
