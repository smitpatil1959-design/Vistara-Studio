/**
 * VISTARA AI Creative Director — the interpretation layer.
 *
 * Natural language in → structured, validated action plan → engine ops out.
 * The director never emits code. Every action is checked against the current
 * document (targets exist, enums valid, fields whitelisted) and grounded in
 * the measured website analysis + intake purpose — shown to the user as noted context.
 */

import { applyCommand } from './engine.js';

/* What the director can say it did — display vocabulary for plans. */
const PLAN_LABELS = {
  updateSlide: 'Edit section',
  insertSlide: 'Add section',
  deleteSlide: 'Remove section',
  updateProject: 'Restyle deck',
  reorder: 'Reorder sections',
  regenerate: 'Regenerate deck',
  noop: null,
};

/** Whitelist for fields the director may write per entity. */
const ALLOWED_SLIDE_FIELDS = new Set(['title', 'subtitle', 'body', 'bullets', 'stats', 'image_url', 'layout', 'animation', 'theme_override', 'sort_order', 'custom_label']);
const ALLOWED_THEME_FIELDS = new Set(['skin', 'accent', 'accent2', 'headingFont', 'bodyFont', 'motion', 'radius']);

function validateOps(ops, slides) {
  const valid = [];
  const dropped = [];
  const ids = new Set(slides.map((s) => s.id));
  let slideWrites = 0;
  let themeWrites = 0;

  for (const op of ops) {
    const out = { ...op };
    if (out.op === 'noop') continue;
    if (out.op === 'updateSlide' || out.op === 'deleteSlide') {
      if (!ids.has(out.id)) {
        dropped.push({ op: out.op, reason: 'target slide missing' });
        continue;
      }
      if (out.op === 'updateSlide') {
        const fields = Object.keys(out.fields || {});
        const bad = fields.filter((f) => !ALLOWED_SLIDE_FIELDS.has(f));
        if (bad.length) {
          dropped.push({ op: out.op, reason: 'outside editable contract', fields: bad });
          for (const f of bad) delete out.fields[f];
        }
        if (out.fields && typeof out.fields.layout === 'string' && !['left', 'center', 'split', 'grid'].includes(out.fields.layout)) {
          dropped.push({ op: out.op, reason: 'unknown layout', value: out.fields.layout });
          out.fields.layout = 'left';
        }
        if (out.fields && typeof out.fields.animation === 'string' && !['fade', 'stagger', 'slide', 'zoom', 'none'].includes(out.fields.animation)) {
          dropped.push({ op: out.op, reason: 'unknown animation', value: out.fields.animation });
          out.fields.animation = 'fade';
        }
        slideWrites++;
      }
    }
    if (out.op === 'insertSlide') {
      // section factories only — never arbitrary payloads
      if (slideWrites > 4) {
        dropped.push({ op: out.op, reason: 'turn budget exceeded (max 4 section writes)' });
        continue;
      }
      slideWrites++;
    }
    if (out.op === 'updateProject' && out.fields?.theme) {
      themeWrites++;
      if (themeWrites > 1) {
        dropped.push({ op: out.op, reason: 'duplicate theme write collapsed' });
        continue;
      }
      const theme = { ...out.fields.theme };
      for (const k of Object.keys(theme)) if (!ALLOWED_THEME_FIELDS.has(k)) delete theme[k];
      out.fields = { ...out.fields, theme };
    }
    if (out.op === 'reorder' && Array.isArray(out.updates)) {
      out.updates = out.updates.filter((u) => ids.has(u.id) && typeof u.sort_order === 'number');
      if (!out.updates.length) {
        dropped.push({ op: out.op, reason: 'nothing left to reorder' });
        continue;
      }
    }
    valid.push(out);
  }
  return { valid, dropped };
}

/** Friendly plan-line for a validated op, with concrete targets. */
function describeOp(op, slides, project) {
  const titleOf = (id) => {
    const s = slides.find((x) => x.id === id);
    const t = (s?.title || s?.custom_label || s?.type || '').replace(/\*/g, '');
    return t ? `"${t.slice(0, 46)}"` : 'section';
  };
  switch (op.op) {
    case 'updateProject': {
      if (op.fields?.theme) {
        const t = op.fields.theme;
        const parts = [];
        if (t.accent) parts.push(`accent ${t.accent}`);
        if (t.skin) parts.push(`${t.skin} skin`);
        if (t.headingFont) parts.push(`${t.headingFont} headlines`);
        if (t.motion) parts.push(`${t.motion} motion`);
        return { icon: 'palette', label: 'Restyled theme', detail: parts.join(' · ') || 'theme tokens updated' };
      }
      if (op.fields?.understanding) return { icon: 'brain', label: 'Rewrote the brief', detail: 'audience, tone or story corrected' };
      return { icon: 'settings', label: 'Project updated', detail: Object.keys(op.fields || {}).join(', ') };
    }
    case 'updateSlide':
      return { icon: 'edit', label: `Edited ${titleOf(op.id)}`, detail: Object.keys(op.fields || {}).join(', ') };
    case 'insertSlide':
      return { icon: 'plus', label: `Added ${titleOf(op.data?.id) || op.data?.type || 'section'}`, detail: 'inserted in sequence' };
    case 'deleteSlide':
      return { icon: 'trash', label: `Removed ${titleOf(op.id)}`, detail: '' };
    case 'reorder':
      return { icon: 'layers', label: 'Reordered narrative', detail: `${op.updates?.length ?? 0} sections re-sequenced` };
    case 'regenerate':
      return { icon: 'refresh', label: 'Regenerated the deck', detail: `rebuilt from the brief for ${project.name}` };
    default:
      return null;
  }
}

/**
 * Director turn: NL directive → plans → validated ops + grounded reply.
 * ctx carries purpose, designPrompt, and audit/understanding context that
 * the composer uses to write an on-brief response.
 */
export function directorTurn(project, slides, command, ctx = {}) {
  const { ops, changes, reply } = applyCommand(project, slides, command);
  const { valid, dropped } = validateOps(ops, slides);

  const plan = valid
    .map((op) => describeOp(op, slides, project))
    .filter(Boolean);

  // context really grounding the edit — honest, from Vistara DNA + scan
  const scan = project.analysis;
  const audit = project.audit;
  const dna = project.dna || project.understanding?.dna || project.analysis?.dna;
  const context = [
    dna?.brandIdentity?.colorPalette?.primary ? `brand: ${dna.brandIdentity.colorPalette.primary}` : null,
    dna?.verificationSummary?.overallScore !== undefined ? `DNA index: ${dna.verificationSummary.overallScore}%` : null,
    scan ? `${scan.pages?.length ?? 0} pages crawled` : null,
    ctx.purpose && ctx.purpose !== 'general' ? `purpose: ${ctx.purpose}` : null,
    project.theme ? `theme: ${project.theme.accent || 'studio lime'} / ${project.theme.skin || 'light'}` : null,
    `${slides.length} sections live`,
  ].filter(Boolean);

  const summary = {
    reply,
    changes,
    ops: valid,
    plan,
    dropped,
    context,
    hasEdits: valid.length > 0,
  };

  // when nothing was understood, reply already carries suggestions — keep them
  if (!valid.length && !changes.length) {
    summary.plan = [{ icon: 'sparkle', label: 'Listening', detail: 'no structural change — suggestions in reply' }];
  }

  return summary;
}
