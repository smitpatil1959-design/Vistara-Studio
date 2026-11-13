/**
 * PPTX composer — maps presentation.v1 slides onto a widescreen Office layout.
 * Flow slots become stable columns/rows; absolute elements keep px-accurate
 * placement. Video becomes a labeled still + link (never dropped). Fonts map
 * to Office-safe faces and are declared in the readiness report.
 */

import { FONT_FALLBACKS } from './readiness.js';
import { exportImageData } from './imageData.js';
import { managedAsset } from '../assetAccess.js';
import { drawElement, pictureBox } from './elements.js';
import { elementBox, flattenElements } from '../spec/index.js';
import sharp from 'sharp';

const EMU_PER_PX = 13.333 / 1280; // inches per canvas pixel at 13.33in wide
const px = (n) => Math.round(n * EMU_PER_PX * 100) / 100;
const FONT_PT = 0.75; // css px → pt

async function fetchAsDataUri(url, projectId) {
  if (!url || (!/^https?:\/\//i.test(url) && !managedAsset(url))) return null;
  try {
    return await exportImageData(url, { projectId });
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

export async function buildPptx(spec, { projectId } = {}) {
  const { SlideFactory } = await safePptx();
  const pptx = SlideFactory();
  const width = 13.333, height = width * spec.canvas.height / spec.canvas.width;
  pptx.defineLayout({ name: 'VISTARA', width, height });
  pptx.layout = 'VISTARA';
  pptx.author = 'Vistara Studio';
  pptx.title = spec.name;
  pptx.subject = spec.meta?.projectUrl || '';

  const pad = spec.theme.spacing?.sectionGap ?? 48;
  const x0 = px(pad + 16);
  const contentW = 13.333 - 2 * x0;
  const bodyFont = FONT_FALLBACKS[spec.theme.typography.bodyFont] || 'Segoe UI';
  const cached = new Map();
  const image = url => {
    if (!cached.has(url)) cached.set(url, fetchAsDataUri(url, projectId));
    return cached.get(url);
  };
  const exportContext = (theme) => ({
    theme,
    font: FONT_FALLBACKS[theme.typography.bodyFont] || theme.typography.bodyFont || 'Segoe UI',
    headingFont: FONT_FALLBACKS[theme.typography.headingFont] || theme.typography.headingFont || 'Segoe UI',
    image,
  });

  for (let i = 0; i < spec.slides.length; i++) {
    const s = spec.slides[i];
    const slide = pptx.addSlide();
    const slideTheme = { ...spec.theme, ...s.themeOverride };
    const context = exportContext(slideTheme);

    // background
    const bgColor = s.background?.type === 'solid' && s.background.value ? hex(s.background.value) : hex(slideTheme.colors.bg);
    slide.background = { color: bgColor };
    if (s.background?.type === 'image' && s.background.value) {
      const bitmap = await image(s.background.value);
      if (!bitmap) throw new Error('A slide background could not be loaded during export.');
      slide.addImage(pictureBox(bitmap, { x: 0, y: 0, w: width, h: height }, 'cover'));
    } else if (s.background?.type === 'gradient') {
      const colors = s.background.value.match(/#[a-f0-9]{6}\b/gi)?.slice(0, 2) || [spec.theme.colors.bg, spec.theme.colors.surfaceAlt];
      const angle = (Number(s.background.value.match(/(-?\d+)deg/)?.[1] ?? 135) - 90) * Math.PI / 180;
      const dx = Math.cos(angle) * 50, dy = Math.sin(angle) * 50;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${Math.round(640 * height / width)}"><defs><linearGradient id="g" x1="${50 - dx}%" y1="${50 - dy}%" x2="${50 + dx}%" y2="${50 + dy}%"><stop stop-color="#${hex(colors[0])}"/><stop offset="1" stop-color="#${hex(colors[1] || colors[0])}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
      const data = await sharp(Buffer.from(svg)).png().toBuffer();
      slide.addImage({ data: `data:image/png;base64,${data.toString('base64')}`, x: 0, y: 0, w: width, h: height });
    }
    const notes = [s.notes, s.sources?.length ? `Sources:\n${s.sources.map(item => `${item.title ? item.title + ' — ' : ''}${item.url}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
    if (notes) slide.addNotes(notes);
    if (s.composition) {
      const scale = width / spec.canvas.width;
      for (const element of flattenElements(s.elements)) {
        const { x, y, w, h } = elementBox(element);
        await drawElement(slide, pptx, element, { x: x * scale, y: y * scale, w: w * scale, h: h * scale }, context);
      }
      continue;
    }

    const visible = s.elements.filter(element => !element.hidden);
    const slot = (name) => visible.filter((e) => e.position.mode !== 'absolute' && e.position.slot === name);
    const kicker = slot('kicker').find(element => element.content.kind === 'text');
    const title = slot('title').find(element => element.content.kind === 'text');
    const subtitle = slot('subtitle').find(element => element.content.kind === 'text');
    const body = slot('body').find(element => element.content.kind === 'text');
    const stats = slot('stat').filter(el => el.type === 'card');
    const cards = slot('card').filter(el => el.type === 'card');
    const media = slot('media').find(element => element.content.kind === 'image');
    const actions = slot('action').filter(element => element.content.kind === 'button');
    const videos = visible.filter((e) => e.type === 'video' && e.position.mode !== 'absolute');
    const abs = visible.filter((e) => e.position.mode === 'absolute');

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
      const bitmap = await image(media.content.src);
      if (bitmap) {
        const box = isCenter ? { x: 4.6, y: 4.1, w: 4.1, h: 2.6 } : { x: x0 + contentW * 0.58, y: 0.9, w: contentW * 0.42, h: 3.35 };
        slide.addImage(pictureBox(bitmap, box, media.content.fit, media.content.focalPoint));
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
      const startY = stats.length ? 3.2 : isCenter ? 4.1 : 3.55;
      const card = () => ({
        w: (contentW - g * (cols - 1)) / cols,
        h: Math.max(0.4, Math.min(1.35, ((stats.length ? 4.4 : 6.8) - startY - g * (rows - 1)) / rows)),
      });
      const csize = card();
      for (const [j, c] of cards.entries()) {
        const col = j % cols;
        const row = Math.floor(j / cols);
        await drawElement(slide, pptx, c, {
          x: x0 + col * (csize.w + g), y: startY + row * (csize.h + g), w: csize.w, h: csize.h,
        }, context);
      }
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

    const consumed = new Set([kicker, title, subtitle, body, media, ...stats, ...cards, ...actions, ...videos].filter(Boolean).map(element => element.id));
    const extras = visible.filter(element => element.position.mode !== 'absolute' && !consumed.has(element.id));
    for (let index = 0; index < extras.length; index++) {
      const element = extras[index];
      const height = Math.max(0.4, 3.1 / Math.max(1, extras.length));
      await drawElement(slide, pptx, element, { x: x0, y: 3.4 + index * height, w: contentW, h: height - 0.08 }, context);
    }
    for (const element of abs) {
      await drawElement(slide, pptx, element, {
        x: px(element.position.x || 0), y: px(element.position.y || 0),
        w: px(typeof element.size.w === 'number' ? element.size.w : 200),
        h: px(typeof element.size.h === 'number' ? element.size.h : 80),
      }, context);
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
