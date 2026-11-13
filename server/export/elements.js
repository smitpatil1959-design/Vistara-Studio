import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { icons } from 'lucide-react';
import sharp from 'sharp';
import { diagramGeometry, readableText } from '../spec/index.js';
import { FONT_FALLBACKS } from './readiness.js';

const hex = (value, fallback = '17170F') => String(value || '').match(/#([0-9a-f]{6})/i)?.[1] || fallback;
const inches = value => value * 13.333 / 1280;
export function pictureBox(bitmap, box, fit = 'cover', focalPoint = { x: 50, y: 50 }) {
  const { width, height, data } = bitmap;
  const { w, h, x, y } = box;
  if (fit === 'fill') return { data, ...box };
  if (fit === 'contain') {
    const scale = Math.min(w / width, h / height);
    return { data, x: x + (w - width * scale) / 2, y: y + (h - height * scale) / 2, w: width * scale, h: height * scale };
  }
  const scale = Math.max(w / width, h / height);
  const iw = width * scale, ih = height * scale;
  return { data, x, y, w: iw, h: ih, sizing: { type: 'crop', w, h, x: (iw - w) * (focalPoint.x ?? 50) / 100, y: (ih - h) * (focalPoint.y ?? 50) / 100 } };
}

export async function drawElement(slide, pptx, element, box, context, depth = 0) {
  if (element.hidden) return;
  if (depth > 6) throw new Error('Element group nesting is too deep to export.');
  const { theme, font, headingFont, image } = context;
  const { x, y, w, h } = box;
  const content = element.content;
  const style = element.style || {};
  const color = hex(style.color || theme.colors.text);
  const fill = hex(style.backgroundColor || theme.colors.surface);
  const opacity = (1 - (style.opacity ?? 1)) * 100;
  const rotate = ((element.rotation || 0) % 360 + 360) % 360;
  const line = style.borderWidth === 0 ? { type: 'none' } : { color: hex(style.borderColor || theme.colors.line), width: style.borderWidth ?? 0.7, transparency: opacity };
  const text = (value, overrides = {}) => slide.addText(String(value || ''), {
    x, y, w, h, fontFace: font, fontSize: (style.fontSize || 17) * 0.75,
    color, bold: (style.fontWeight || 500) >= 600, italic: style.fontStyle === 'italic', align: style.textAlign || 'left',
    rotate, transparency: opacity, charSpacing: (style.letterSpacing || 0) * 0.75,
    ...(style.lineHeight ? { lineSpacing: (style.fontSize || 17) * 0.75 * style.lineHeight } : {}),
    margin: 0, breakLine: false, valign: 'top', fit: 'shrink', ...overrides,
  });
  if (content.kind === 'text') return text(content.text.replace(/\*([^*]+)\*/g, '$1'), { fontFace: style.fontFamily ? (FONT_FALLBACKS[style.fontFamily] || style.fontFamily) : ['title', 'kicker'].includes(content.role) ? headingFont : font, bold: (style.fontWeight || (content.role === 'title' ? 700 : 500)) >= 600, ...(style.backgroundColor ? { fill: { color: fill, transparency: opacity } } : {}) });
  if (content.kind === 'image') {
    const bitmap = await image(content.src);
    if (!bitmap) throw new Error('A presentation image could not be loaded during export.');
    slide.addImage({ ...pictureBox(bitmap, box, content.fit, content.focalPoint), rotate, transparency: opacity, altText: content.alt }); return;
  }
  if (content.kind === 'icon') {
    const name = String(content.name || 'sparkles').replace(/(^|[-_\s])(\w)/g, (_, _prefix, letter) => letter.toUpperCase());
    const Icon = icons[name] || icons.Sparkles;
    const svg = renderToStaticMarkup(createElement(Icon, { size: 96, color: `#${color}`, strokeWidth: 1.8 }));
    const data = await sharp(Buffer.from(svg)).png().toBuffer();
    const size = Math.min(w, h);
    slide.addImage({ data: `data:image/png;base64,${data.toString('base64')}`, x, y, w: size, h: size, rotate, transparency: opacity }); return;
  }
  if (content.kind === 'shape') {
    const kind = content.shape;
    const shape = ['circle', 'glow'].includes(kind) ? pptx.ShapeType.ellipse
      : ['line', 'divider'].includes(kind) ? pptx.ShapeType.line
      : kind === 'pill' || style.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
    slide.addShape(shape, { x, y, w, h: ['line', 'divider'].includes(kind) ? 0 : h, rotate,
      line: ['line', 'divider'].includes(kind) ? { color: hex(style.backgroundColor || theme.colors.accent), width: style.borderWidth || 1.5 } : line,
      fill: { color: hex(style.backgroundColor || theme.colors.surfaceAlt), transparency: (1 - (style.opacity ?? (kind === 'glow' ? 0.25 : 1))) * 100 },
    }); return;
  }
  if (content.kind === 'button') {
    const buttonColor = style.backgroundColor || theme.colors.accent;
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rotate, fill: { color: hex(buttonColor), transparency: opacity }, line });
    return text(content.label, { color: hex(style.color || readableText(buttonColor)), align: 'center', valign: 'mid', bold: true,
      ...( /^https?:\/\//i.test(content.href || '') ? { hyperlink: { url: content.href } } : {}),
    });
  }
  if (content.kind === 'card') {
    slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rotate, fill: { color: fill, transparency: opacity }, line });
    const padding = Math.min(inches(style.padding?.[0] || 18), w * 0.09, h * 0.20);
    const area = { x: x + padding, y: y + padding, w: Math.max(0.1, w - padding * 2), h: Math.max(0.1, h - padding * 2) };
    const lines = [];
    if (content.metric) lines.push({ text: String(content.metric), options: { fontSize: 22, bold: true, breakLine: true } });
    else if (content.index != null && !content.icon) lines.push({ text: String(content.index + 1).padStart(2, '0'), options: { fontSize: 9, breakLine: true, color: hex(theme.colors.accent) } });
    if (content.title) lines.push({ text: String(content.title), options: { fontSize: (style.fontSize || 18) * 0.75, bold: true, breakLine: Boolean(content.body) } });
    if (content.body) lines.push({ text: String(content.body), options: { fontSize: (style.bodyFontSize || (style.fontSize <= 14 ? 12 : 14)) * 0.75 } });
    if (content.icon) {
      const iconSize = Math.min(0.24, area.h * 0.28);
      await drawElement(slide, pptx, { ...element, content: { kind: 'icon', name: content.icon } }, { x: area.x, y: area.y, w: iconSize, h: iconSize }, context, depth);
      area.y += iconSize + 0.06;
      area.h = Math.max(0.1, area.h - iconSize - 0.06);
    }
    return slide.addText(lines, { ...area, fontFace: font, color, rotate, transparency: opacity, valign: 'mid', margin: 0, fit: 'shrink' });
  }
  if (content.kind === 'chart') {
    if (!content.series?.length) return text('No chart data');
    const type = { bars: 'bar', line: 'line', area: 'area', pie: 'pie', donut: 'doughnut', progress: 'bar' }[content.chart] || 'bar';
    const circular = ['pie', 'doughnut'].includes(type);
    slide.addChart(pptx.ChartType[type], [{ name: content.axisLabel || 'Values', labels: content.series.map(item => item.label), values: content.series.map(item => circular ? Math.max(0, item.value) : item.value) }], {
      x, y, w, h, barDir: content.chart === 'progress' ? 'bar' : 'col', chartColors: (content.colors?.length ? content.colors : [theme.colors.accent, theme.colors.accent2, '#8BA17B', '#D8AF5F', '#6E8BC6', '#B984A9']).map(item => hex(item)), fontFace: font,
      showLegend: !!content.legend, showTitle: false, catAxisLabelFontSize: 9, showValue: content.showValues !== false, showCatAxisTitle: !circular && !!content.axisLabel, catAxisTitle: content.axisLabel,
      chartArea: { fill: { color: fill } }, valAxisLabelColor: color, catAxisLabelColor: color,
    }); return;
  }
  if (content.kind === 'table') {
    const columns = Math.max(1, ...content.rows.map(row => row.length));
    const rows = content.rows.map((row, index) => Array.from({ length: columns }, (_, i) => {
      const header = index === 0 && content.headerRow;
      return { text: row[i] || '', options: { bold: header, color: header ? hex(readableText(theme.colors.accent)) : color, fill: { color: header ? hex(theme.colors.accent) : index % 2 ? fill : hex(theme.colors.surfaceAlt) } } };
    }));
    if (rows.length) slide.addTable(rows, { x, y, w, h, colW: w / columns, rowH: h / rows.length, autoPage: false, fontFace: font, fontSize: (style.fontSize || 17) * 0.75, border: { color: hex(theme.colors.line), pt: 0.5 }, margin: 5 });
    return;
  }
  if (content.kind === 'diagram') {
    const sx = w / 1000, sy = h / Math.max(1, h / w * 1000);
    const nodes = diagramGeometry(content, 1000, h / w * 1000);
    for (const edge of content.edges) {
      const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to);
      if (!from || !to) continue;
      const ax = from.x + from.w / 2, ay = from.y + from.h / 2, bx = to.x + to.w / 2, by = to.y + to.h / 2;
      slide.addShape(pptx.ShapeType.line, { x: x + Math.min(ax, bx) * sx, y: y + Math.min(ay, by) * sy, w: Math.abs(bx - ax) * sx, h: Math.abs(by - ay) * sy, flipH: bx < ax, flipV: by < ay, line: { color: hex(theme.colors.accent), width: 1.4, endArrowType: 'triangle' } });
    }
    for (const node of nodes) {
      const nodeBox = { x: x + node.x * sx, y: y + node.y * sy, w: node.w * sx, h: node.h * sy };
      slide.addShape(pptx.ShapeType.roundRect, { ...nodeBox, fill: { color: fill }, line });
      text([node.label, node.detail].filter(Boolean).join('\n'), { ...nodeBox, rotate: 0, margin: 8, fontSize: (style.fontSize || 18) * 0.75, valign: 'mid' });
    }
    return;
  }
  if (content.kind === 'video') {
    const bitmap = content.poster ? await image(content.poster) : null;
    if (bitmap) slide.addImage({ ...pictureBox(bitmap, box), rotate });
    else slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: '17170F' }, line });
    return text('Video — open to play', { color: 'FFFFFF', align: 'center', valign: 'mid', ...( /^https?:\/\//i.test(content.src || '') ? { hyperlink: { url: content.src } } : {}) });
  }
  if (content.kind === 'group') {
    const children = content.children || [];
    const gap = inches(theme.spacing.unit * 2);
    const weights = children.map(child => typeof child.size.h === 'number' ? child.size.h : 80);
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const available = Math.max(0.1, h - gap * Math.max(0, children.length - 1));
    let offset = y;
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      const childHeight = available * weights[index] / total;
      const absolute = child.position.mode === 'absolute';
      await drawElement(slide, pptx, child, {
        x: absolute ? x + inches(child.position.x || 0) : x,
        y: absolute ? y + inches(child.position.y || 0) : offset,
        w: typeof child.size.w === 'number' ? inches(child.size.w) : w,
        h: absolute && typeof child.size.h === 'number' ? inches(child.size.h) : childHeight,
      }, context, depth + 1);
      if (!absolute) offset += childHeight + gap;
    }
    return;
  }
  throw new Error(`Unsupported export element: ${content.kind}`);
}
