/**
 * PPTX composer — maps presentation.v1 slides onto a widescreen Office layout.
 * Flow slots become stable columns/rows; absolute elements keep px-accurate
 * placement. Video becomes a labeled still + link (never dropped). Fonts map
 * to Office-safe faces and are declared in the readiness report.
 */

import { FONT_FALLBACKS } from './readiness.js';
import { validateTarget, safeDispatcher } from '../security.js';

const EMU_PER_PX = 13.333 / 1280; // inches per canvas pixel at 13.33in wide
const px = (n) => Math.round(n * EMU_PER_PX * 100) / 100;
const FONT_PT = 0.75; // css px → pt

async function fetchAsDataUri(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    await validateTarget(url);
    const r = await fetch(url, { signal: AbortSignal.timeout(9000), dispatcher: safeDispatcher });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null;
    const mime = r.headers.get('content-type') || 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function hex(c, fallback = 'FFFFFF') {
  const m = String(c || '').match(/#([0-9a-f]{6})/i);
  return m ? m[1].toUpperCase() : fallback;
}

function richText(specTheme, text, sizePx, weight) {
  const fontFace = FONT_FALLBACKS[specTheme.typography.headingFont] || FONT_FALLBACKS[specTheme.typography.bodyFont] || 'Segoe UI';
  const parts = [];
  String(text || '')
    .split('*')
    .forEach((chunk, i) => {
      parts.push({
        text: chunk,
        options: { fontFace, fontSize: Math.round(sizePx * FONT_PT), bold: weight === 'bold', italic: i % 2 === 1, color: i % 2 === 1 ? hex(specTheme.colors.accent) : hex(specTheme.colors.text) },
      });
    });
  return parts;
}

function addFooter(slide, spec, index) {
  const y = px(720 - 38);
  slide.addText('VISTARA STUDIO', {
    x: px(64), y, w: 3.2, h: 0.22, fontFace: 'Segoe UI', fontSize: 8, color: hex(spec.theme.colors.muted, '888888'), charSpacing: 4,
  });
  slide.addText(`${String(index + 1).padStart(2, '0')} / ${String(spec.slides.length).padStart(2, '0')}`, {
    x: 10.4, y, w: 2.2, h: 0.22, align: 'right', fontFace: 'Segoe UI', fontSize: 8.5, color: hex(spec.theme.colors.accent), bold: true,
  });
}

export async function buildPptx(spec) {
  const { SlideFactory } = await safePptx();
  const pptx = SlideFactory();
  pptx.defineLayout({ name: 'VISTARA', width: 13.333, height: 7.5 });
  pptx.layout = 'VISTARA';
  pptx.author = 'Vistara Studio';
  pptx.title = spec.name;
  pptx.subject = spec.meta?.projectUrl || '';

  const pad = spec.theme.spacing?.sectionGap ?? 48;
  const x0 = px(pad + 16);
  const contentW = 13.333 - 2 * x0;
  const bodyFont = FONT_FALLBACKS[spec.theme.typography.bodyFont] || 'Segoe UI';

  for (let i = 0; i < spec.slides.length; i++) {
    const s = spec.slides[i];
    const slide = pptx.addSlide();

    // background
    const bgColor = s.background?.type === 'solid' && s.background.value ? hex(s.background.value) : hex(spec.theme.colors.bg);
    slide.background = { color: bgColor };
    if (s.background?.type === 'image' && s.background.value) {
      const uri = await fetchAsDataUri(s.background.value);
      if (uri) slide.addImage({ data: uri, x: 0, y: 0, w: '100%', h: '100%' });
    }

    const slot = (name) => s.elements.filter((e) => e.position.slot === name);
    const kicker = slot('kicker')[0];
    const title = slot('title')[0];
    const subtitle = slot('subtitle')[0];
    const body = slot('body')[0];
    const stats = slot('stat').slice(0, 4);
    const cards = slot('card');
    const media = slot('media')[0];
    const actions = slot('action');
    const videos = s.elements.filter((e) => e.type === 'video');
    const abs = s.elements.filter((e) => e.position.mode === 'absolute');

    const isCenter = s.layout === 'center' || s.section === 'cta';
    let y = px(pad * 0.9);

    // kicker
    if (kicker && kicker.content.kind === 'text') {
      slide.addText(kicker.content.text.toUpperCase(), { x: x0, y, w: contentW, h: 0.3, align: isCenter ? 'center' : 'left', fontFace: bodyFont, fontSize: 9, color: hex(spec.theme.colors.accent), charSpacing: 4, bold: true });
      y += 0.36;
    }
    // title / subtitle / body
    if (title && title.content.kind === 'text') {
      slide.addText(richText(spec.theme, title.content.text, 56, 'bold'), { x: x0, y, w: contentW, h: 1.15, align: isCenter ? 'center' : 'left', valign: 'top' });
      y += 1.2;
    }
    if (subtitle && subtitle.content.kind === 'text') {
      slide.addText(subtitle.content.text, { x: x0, y, w: contentW, h: 0.45, align: isCenter ? 'center' : 'left', fontFace: bodyFont, fontSize: 13, color: hex(spec.theme.colors.muted) });
      y += 0.52;
    }
    if (body && body.content.kind === 'text') {
      slide.addText(body.content.text, { x: x0, y, w: media ? contentW * 0.54 : contentW * 0.72, h: 1.05, align: isCenter ? 'center' : 'left', fontFace: bodyFont, fontSize: 11.5, color: hex(spec.theme.colors.muted), lineSpacing: 18 });
    }

    // media column (split/left) or centered media
    if (media && media.content.kind === 'image') {
      const uri = await fetchAsDataUri(media.content.src);
      if (uri) {
        if (isCenter) slide.addImage({ data: uri, x: 4.6, y: 4.1, w: 4.1, h: 2.6, sizing: { type: 'cover', w: 4.1, h: 2.6 } });
        else slide.addImage({ data: uri, x: x0 + contentW * 0.58, y: 0.9, w: contentW * 0.42, h: 3.35, sizing: { type: 'cover', w: contentW * 0.42, h: 3.35 } });
      } else {
        slide.addShape(pptx.ShapeType.roundRect, { x: x0 + contentW * 0.58, y: 0.9, w: contentW * 0.42, h: 3.35, rectRadius: 0.08, fill: { color: hex(spec.theme.colors.surfaceAlt, 'EFEEE6') }, line: { color: hex(spec.theme.colors.line, 'DDDDDD'), width: 1 } });
        slide.addText('Image unavailable during export', { x: x0 + contentW * 0.58, y: 2.4, w: contentW * 0.42, align: 'center', fontFace: bodyFont, fontSize: 9, color: hex(spec.theme.colors.muted, '888888') });
      }
    }

    // stats strip
    if (stats.length) {
      const colW = (contentW - (stats.length - 1) * 0.24) / stats.length;
      stats.forEach((st, j) => {
        const x = x0 + j * (colW + 0.24);
        const sy = 4.55;
        slide.addShape(pptx.ShapeType.roundRect, { x, y: sy, w: colW, h: 1.0, rectRadius: 0.07, fill: { color: hex(spec.theme.colors.surface, 'FFFFFF') }, line: { color: hex(spec.theme.colors.line, 'DDDDDD'), width: 1 } });
        const c = st.content;
        if (c.kind === 'card') {
          slide.addText(String(c.metric || ''), { x: x + 0.1, y: sy + 0.12, w: colW - 0.2, align: 'center', fontFace: FONT_FALLBACKS[spec.theme.typography.headingFont] || 'Segoe UI', fontSize: 22, bold: true, color: hex(spec.theme.colors.accent) });
          slide.addText(String(c.title || ''), { x: x + 0.1, y: sy + 0.62, w: colW - 0.2, align: 'center', fontFace: bodyFont, fontSize: 8.5, color: hex(spec.theme.colors.muted, '777777'), charSpacing: 2 });
        }
      });
    }

    // cards grid
    if (cards.length) {
      const cols = cards.length <= 1 ? 1 : cards.length <= 2 ? 2 : cards.length <= 4 ? 2 : 3;
      const rows = Math.ceil(cards.length / cols);
      const g = 0.18;
      const startY = stats.length && media ? 0 : stats.length ? 5.0 : isCenter ? 4.4 : 3.55;
      const card = (cw, chh) => ({
        w: (contentW - g * (cols - 1)) / cols,
        h: Math.min(chh, 1.35),
      });
      const csize = card(0, 0);
      cards.slice(0, 6).forEach((c, j) => {
        const cz = csize;
        const col = j % cols;
        const row = Math.floor(j / cols);
        const x = x0 + col * (csize.w + g);
        const yy = startY + row * (csize.h + g);
        if (yy + csize.h > 6.8) return;
        slide.addShape(pptx.ShapeType.roundRect, { x, y: yy, w: csize.w, h: csize.h, rectRadius: 0.07, fill: { color: hex(spec.theme.colors.surface, 'FFFFFF') }, line: { color: hex(spec.theme.colors.line, 'DDDDDD'), width: 1 } });
        if (c.content.kind === 'card') {
          const idx = c.content.index != null ? `${String(c.content.index + 1).padStart(2, '0')} ` : '';
          slide.addText(idx + (c.content.title || ''), { x: x + 0.16, y: yy + 0.12, w: csize.w - 0.32, fontFace: FONT_FALLBACKS[spec.theme.typography.headingFont] || 'Segoe UI', fontSize: 11, bold: true, color: hex(spec.theme.colors.text) });
          if (c.content.body) slide.addText(c.content.body, { x: x + 0.16, y: yy + 0.5, w: csize.w - 0.32, h: csize.h - 0.62, fontFace: bodyFont, fontSize: 8.5, color: hex(spec.theme.colors.muted, '777777'), valign: 'top' });
        }
      });
      void rows;
    }

    // action buttons → accent pills (hyperlinked)
    actions.forEach((b, j) => {
      if (b.content.kind !== 'button') return;
      const bx = isCenter ? 5.35 + j * 2.5 : x0 + j * 2.5;
      const by = 4.05;
      slide.addShape(pptx.ShapeType.roundRect, { x: bx, y: by, w: 2.3, h: 0.5, rectRadius: 0.25, fill: { color: hex(spec.theme.colors.accent) } });
      const opts = { x: bx, y: by, w: 2.3, h: 0.5, align: 'center', fontFace: bodyFont, fontSize: 11, bold: true, color: spec.theme.skin === 'dark' ? 'FFFFFF' : 'FFFFFF' };
      if (b.content.href && /^https?:/i.test(b.content.href)) opts.hyperlink = { url: b.content.href };
      slide.addText(b.content.label || 'Open', opts);
    });

    // videos — never dropped: labeled still + link
    videos.forEach((v, j) => {
      const vx = isCenter ? 4.6 : x0, vy = 4.5 + j * 1.2;
      slide.addShape(pptx.ShapeType.roundRect, { x: vx, y: vy, w: isCenter ? 4.1 : 4.4, h: 1.0, rectRadius: 0.08, fill: { color: '17170F' } });
      const vc = v.content.kind === 'video' ? v.content : null;
      slide.addText([
        { text: '▶  Video — plays on web export', options: { bold: true, color: 'F4F4EF', fontFace: bodyFont, fontSize: 10 } },
        { text: vc?.src ? `\n${vc.src.slice(0, 64)}` : '', options: { color: '9DB494', fontFace: 'Consolas', fontSize: 7.5 } },
      ], { x: vx + 0.18, y: vy + 0.16, w: (isCenter ? 4.1 : 4.4) - 0.36, h: 0.75, ...(vc?.src ? { hyperlink: { url: vc.src } } : {}) });
    });

    // absolute elements: exact stage coordinates
    for (const el of abs) {
      const x = px(el.position.x ?? 0);
      const y = px(el.position.y ?? 0);
      const w = px(typeof el.size.w === 'number' ? el.size.w : 200);
      const h = px(typeof el.size.h === 'number' ? el.size.h : 80);
      if (el.type === 'text' && el.content.kind === 'text') {
        slide.addText(richText(spec.theme, el.content.text, el.style?.fontSize ?? 17, (el.style?.fontWeight ?? 500) >= 600 ? 'bold' : 'normal'), { x, y, w, h, valign: 'top' });
      } else if (el.type === 'image' && el.content.kind === 'image') {
        const uri = await fetchAsDataUri(el.content.src);
        if (uri) slide.addImage({ data: uri, x, y, w, h });
      } else if (el.type === 'shape') {
        slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: hex(el.style?.backgroundColor || spec.theme.colors.surfaceAlt, 'EFEEE6') } });
      } else if (el.type === 'card' && el.content.kind === 'card') {
        slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.07, fill: { color: hex(spec.theme.colors.surface, 'FFFFFF') }, line: { color: hex(spec.theme.colors.line, 'DDDDDD'), width: 1 } });
        slide.addText(`${el.content.title}${el.content.body ? '\n' + el.content.body : ''}`, { x: x + 0.14, y: y + 0.1, w: w - 0.28, h: h - 0.2, fontFace: bodyFont, fontSize: 9.5, color: hex(spec.theme.colors.text), valign: 'top' });
      } else if (el.type === 'chart' && el.content.kind === 'chart' && el.content.series.length) {
        const labels = el.content.series.map((p) => String(p.label).slice(0, 6));
        const values = el.content.series.map((p) => (Number.isFinite(p.value) ? Number(p.value) : 0));
        try {
          slide.addChart(pptx.ChartType.bar, [{ name: 'series', labels, values }], { x, y, w, h, barDir: 'bar', chartColors: [hex(spec.theme.colors.accent)], fontFace: bodyFont, catAxisLabelFontSize: 8 });
        } catch { /* chart data rejected — readiness report already flags it */ }
      }
    }

    addFooter(slide, spec, i);
  }

  return pptx;
}

async function safePptx() {
  const mod = await import('pptxgenjs');
  const PptxGenJS = mod.default || mod;
  return { SlideFactory: () => new PptxGenJS() };
}
