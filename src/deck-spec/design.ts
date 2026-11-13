import type { BrandKit, PresentationSpec, SlideElement, SlideSpec, ThemeSpec } from './types';
import { newSpecId } from './validate';
import { colorHex, contrast, deriveBrandKit, readableText, themeFromBrand, tint } from './brand';

export type CompositionKind = 'cover' | 'statement' | 'grid' | 'split' | 'comparison' | 'diagram' | 'metrics' | 'image' | 'quote' | 'sources' | 'swot' | 'chart';
export interface CompositionPreset { id: string; name: string; kind: CompositionKind; columns?: number; description: string; }
export const COMPOSITIONS: CompositionPreset[] = [
  ['cover', 'Brand cover', 'cover', 1, 'A strong opening with room for the brand.'],
  ['divider', 'Section divider', 'statement', 1, 'One clear transition in the story.'],
  ['summary', 'Executive summary', 'grid', 3, 'Three essential takeaways.'],
  ['overview', 'Company overview', 'split', 2, 'Context beside supporting evidence.'],
  ['insight', 'Key insight', 'statement', 1, 'Make the main idea unmistakable.'],
  ['metric', 'Large metric', 'metrics', 1, 'A verified number and its context.'],
  ['dashboard', 'Metric dashboard', 'metrics', 3, 'Compare a small set of actual measurements.'],
  ['comparison-two', 'Two-column comparison', 'comparison', 2, 'A balanced side-by-side view.'],
  ['comparison-three', 'Three-column comparison', 'comparison', 3, 'Three dimensions with equal emphasis.'],
  ['timeline', 'Timeline', 'diagram', 4, 'A sequence with meaningful milestones.'],
  ['process', 'Process', 'diagram', 4, 'Connected steps with a clear direction.'],
  ['features', 'Feature showcase', 'grid', 2, 'A focused, spacious capability grid.'],
  ['image-story', 'Image-led story', 'image', 2, 'A relevant image beside the takeaway.'],
  ['full-image', 'Full-bleed image', 'image', 1, 'An image with a readable editorial panel.'],
  ['quote', 'Quote', 'quote', 1, 'A supplied statement in an editorial treatment.'],
  ['market', 'Market overview', 'split', 2, 'Evidence and context without invented market size.'],
  ['landscape', 'Competitive landscape', 'comparison', 3, 'Compare documented differentiators.'],
  ['swot', 'SWOT analysis', 'swot', 2, 'Four supplied analytical dimensions.'],
  ['problem-solution', 'Problem and solution', 'comparison', 2, 'Connect the problem to the supported response.'],
  ['journey', 'Customer journey', 'diagram', 4, 'A sequence grounded in the product workflow.'],
  ['business-model', 'Business model', 'grid', 3, 'Explain how the organization works.'],
  ['architecture', 'Technology architecture', 'diagram', 3, 'Connected systems with editable labels.'],
  ['findings', 'Research findings', 'grid', 2, 'Clear findings and traceable evidence.'],
  ['evidence', 'Evidence summary', 'split', 2, 'Separate the insight from its support.'],
  ['data', 'Data visualization', 'chart', 1, 'Verified quantitative data only.'],
  ['case-study', 'Case study', 'image', 2, 'An image, context and a supported outcome.'],
  ['roadmap', 'Roadmap', 'diagram', 4, 'A supplied plan, clearly labelled as a plan.'],
  ['recommendations', 'Recommendations', 'grid', 3, 'Actionable, explicitly interpreted next steps.'],
  ['risks', 'Risks and limitations', 'grid', 2, 'Make uncertainty and constraints visible.'],
  ['conclusion', 'Branded conclusion', 'statement', 1, 'End with one useful message.'],
  ['sources', 'Sources and references', 'sources', 1, 'Keep the original evidence close.'],
].map(([id, name, kind, columns, description]) => ({ id, name, kind, columns, description })) as CompositionPreset[];

const copy = <T,>(value: T): T => structuredClone(value);
export function fitFont(text: string, width: number, height: number, preferred = 48, minimum = 14, lineHeight = 1.15): number {
  let size = preferred;
  const lines = (font: number) => String(text).split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length * font * 0.53 / width)), 0);
  while (size > minimum && lines(size) * size * lineHeight > height) size -= 1;
  return size;
}
function element(type: SlideElement['type'], content: SlideElement['content'], x: number, y: number, w: number, h: number, style: SlideElement['style'] = {}, metadata: SlideElement['metadata'] = {}): SlideElement {
  return { id: newSpecId(), type, content, position: { mode: 'absolute', x, y }, size: { w, h }, style, animation: { preset: 'rise', delayMs: 0 }, metadata: { designed: true, ...metadata }, rotation: 0, locked: false };
}
function text(value: string, role: 'title' | 'subtitle' | 'body' | 'caption' | 'kicker', x: number, y: number, w: number, h: number, color: string, fontSize: number, style: SlideElement['style'] = {}): SlideElement {
  return element('text', { kind: 'text', text: value, role }, x, y, w, h, { color, fontSize: fitFont(value, w, h, fontSize, role === 'caption' ? 10 : 14, role === 'title' ? 1.1 : 1.4), lineHeight: role === 'title' ? 1.1 : 1.4, ...style });
}
export function slidePalette(theme: ThemeSpec, variant: number) {
  const primary = colorHex(theme.colors.accent) || '#506A46';
  const bg = variant === 0 ? primary : variant === 2 ? tint(primary, '#101916', 0.92) : variant === 4 ? tint(primary, '#FFFFFF', 0.93) : theme.colors.bg;
  const ink = contrast(theme.colors.text, bg) >= 4.5 ? theme.colors.text : readableText(bg), dark = readableText(bg) === '#FFFFFF';
  const muted = tint(ink, bg, 0.23);
  return { bg, text: ink, muted: contrast(muted, bg) >= 4.5 ? muted : ink, accent: contrast(bg, primary) >= 4.5 ? primary : ink, card: dark ? tint(bg, '#FFFFFF', 0.08) : '#FFFFFF', line: tint(ink, bg, 0.86), primary };
}

/** Recompose actual slide content; never generate a fact, number or chart point. */
export function composeSlide(input: SlideSpec, theme: ThemeSpec, presetId: string, index = 0, total = 1, brand?: BrandKit, variant = index % 5): SlideSpec {
  const preset = COMPOSITIONS.find(item => item.id === presetId) || COMPOSITIONS[2];
  const slide = copy(input), original = slide.elements;
  const role = (name: string) => original.find(el => el.content.kind === 'text' && (el.content.role === name || el.position.slot === name));
  const value = (name: string) => { const el = role(name); return el?.content.kind === 'text' ? el.content.text : ''; };
  const title = value('title') || slide.label;
  const subtitleRole = value('subtitle') ? 'subtitle' : 'body';
  const subtitle = value(subtitleRole);
  const cards = original.filter(el => el.content.kind === 'card').slice(0, 6);
  const metricCards = cards.filter(el => el.content.kind === 'card' && el.content.metric);
  const image = original.find(el => el.content.kind === 'image' && el.content.src);
  const chart = original.find(el => el.content.kind === 'chart' && el.content.series.length);
  const palette = slidePalette(theme, variant);
  const elements: SlideElement[] = [];
  const absorbed = new Set<string>();
  const pushTitle = (x = 64, y = 102, w = 1152, h = 130, size = 48) => elements.push(text(title, 'title', x, y, w, h, palette.text, size));
  const pushSubtitle = (x = 64, y = 232, w = 1100, h = 80) => { if (subtitle) elements.push(text(subtitle, 'subtitle', x, y, w, h, palette.muted, 22)); };
  const pushCard = (card: SlideElement, x: number, y: number, w: number, h: number, order: number) => {
    const next = copy(card); next.position = { mode: 'absolute', x, y, slot: card.position.slot || 'card', order }; next.size = { w, h };
    next.style = { ...next.style, backgroundColor: palette.card, color: readableText(palette.card), borderColor: palette.line, radius: theme.radius.md, fontSize: h < 150 ? 14 : 18, padding: h < 150 ? [16, 16, 16, 16] : [24, 24, 24, 24] };
    if (slide.metadata.storyComposition && next.content.kind === 'card') {
      const padding = h < 185 ? 15 : 22;
      next.style.padding = [padding, padding, padding, padding];
      next.style.bodyFontSize = fitFont(next.content.body, w - 2 * padding, h - 2 * padding - 49, 16, 12, 1.4);
      next.content.index = null;
    }
    next.metadata = { ...next.metadata, designed: true }; elements.push(next);
  };
  const grid = (items: SlideElement[], columns: number, y = 330, height = 270) => {
    const count = Math.min(items.length, columns * 2), rows = Math.max(1, Math.ceil(count / columns)), gap = 22;
    items.slice(0, count).forEach((card, i) => pushCard(card, 64 + (i % columns) * (1174 / columns), y + Math.floor(i / columns) * ((height + gap) / rows), (1152 - (columns - 1) * gap) / columns, (height - (rows - 1) * gap) / rows, i));
  };
  elements.push(text((value('kicker') || slide.label).toUpperCase(), 'kicker', 64, 52, 1000, 24, palette.accent, 12, { letterSpacing: 2.2 }));
  if (preset.kind === 'cover') {
    elements.push(element('shape', { kind: 'shape', shape: 'rect' }, 64, 128, 64, 7, { backgroundColor: palette.accent, borderWidth: 0 }, { decorative: true }));
    pushTitle(64, 190, image ? 640 : 1100, 235, 78); pushSubtitle(66, 455, image ? 620 : 1000, 100);
    if (image) {
      const next = copy(image);
      next.position = { mode: 'absolute', x: 750, y: 150, slot: 'media' };
      next.size = { w: 466, h: 420 };
      next.style = { ...next.style, radius: variant === 5 ? 12 : 24 };
      if (variant === 5 && next.content.kind === 'image') next.content.fit = 'contain';
      elements.push(next);
    }
    if (brand?.logoUrl) elements.push(element('image', { kind: 'image', src: brand.logoUrl, alt: `${brand.brandName} logo`, fit: 'contain', frame: 'none' }, 64, 590, 150, 40, { radius: 0 }, { semantic: 'logo' }));
  } else if (preset.kind === 'statement' || preset.kind === 'quote') {
    pushTitle(80, 150, 1080, subtitle ? 230 : 330, preset.kind === 'quote' ? 62 : 72);
    pushSubtitle(84, 428, 960, 120);
    if (cards.length) pushCard(cards[0], 84, 548, 850, 100, 0);
  } else if (preset.kind === 'image' && image) {
    if (preset.id === 'full-image') {
      const next = copy(image); next.position = { mode: 'absolute', x: 0, y: 0, slot: 'media' }; next.size = { w: 1280, h: 720 }; next.style = { radius: 0 }; next.metadata = { ...next.metadata, decorative: true }; elements.unshift(next);
      elements.push(element('shape', { kind: 'shape', shape: 'rect' }, 40, 120, 690, 480, { backgroundColor: palette.bg, radius: 18 }, { decorative: true }));
      pushTitle(72, 160, 620, 210, 58); pushSubtitle(74, 390, 600, 130);
    } else {
      pushTitle(64, 140, 580, 200, 54); pushSubtitle(66, 360, 560, 110);
      const next = copy(image); next.position = { mode: 'absolute', x: 730, y: 130, slot: 'media' }; next.size = { w: 486, h: 460 }; next.style = { ...next.style, radius: theme.radius.lg }; elements.push(next);
      if (cards[0]) pushCard(cards[0], 64, 500, 580, 120, 0);
    }
  } else if (preset.id === 'timeline' && slide.metadata.storyComposition && cards.length) {
    pushTitle(64, 95, 1152, 110, 51);
    elements.push(element('shape', { kind: 'shape', shape: 'rect' }, 64, 410, 1152, 4, { backgroundColor: palette.accent }, { decorative: true }));
    const width = (1152 - (cards.length - 1) * 20) / cards.length;
    cards.forEach((card, i) => {
      const left = 64 + i * (width + 20), center = left + width / 2;
      const above = i % 2 === 0;
      elements.push(element('shape', { kind: 'shape', shape: 'rect' }, center - 1, above ? 376 : 412, 2, 33, { backgroundColor: palette.accent }, { decorative: true }));
      elements.push(element('shape', { kind: 'shape', shape: 'circle' }, center - 9, 403, 18, 18, { backgroundColor: palette.accent }, { decorative: true }));
      pushCard(card, left, above ? 204 : 445, width, 172, i);
    });
  } else if (preset.kind === 'diagram' && cards.length) {
    pushTitle(); pushSubtitle(64, 235, 1120, 70);
    const nodes = cards.slice(0, preset.columns || 4).map(card => {
      absorbed.add(card.id);
      return { id: card.id, label: card.content.kind === 'card' ? card.content.title : '', detail: card.content.kind === 'card' ? [card.content.metric, card.content.body].filter(Boolean).join(' · ') : '' };
    });
    elements.push(element('diagram', { kind: 'diagram', layout: preset.id === 'architecture' ? 'architecture' : /timeline|roadmap/.test(preset.id) ? 'timeline' : 'process', nodes, edges: nodes.slice(1).map((node, i) => ({ from: nodes[i].id, to: node.id })) }, 64, slide.metadata.storyComposition ? 250 : 340, 1152, slide.metadata.storyComposition ? 350 : 250, { color: readableText(palette.card), backgroundColor: palette.card, borderColor: palette.line }));
  } else if ((preset.id === 'landscape' || preset.id === 'dashboard') && slide.metadata.storyComposition && cards.length) {
    pushTitle(64, 95, 1152, 110, 51);
    const rows = [[preset.id === 'dashboard' ? 'Measure' : 'Topic', preset.id === 'dashboard' ? 'Reported figure and context' : 'What the sources say'], ...cards.flatMap(card => {
      if (card.content.kind !== 'card') return [];
      absorbed.add(card.id);
      return [[card.content.title, card.content.body]];
    })];
    elements.push(element('table', { kind: 'table', headerRow: true, rows }, 64, 232, 1152, 375, { color: readableText(palette.card), backgroundColor: palette.card, fontSize: 17 }));
  } else if (preset.kind === 'sources') {
    pushTitle(64, 95, 1120, 100, 52);
    const sources = slide.sources || [];
    if (sources.length) sources.slice(0, 8).forEach((source, i) => elements.push(text(`${String(i + 1).padStart(2, '0')}  ${source.title || source.url}\n${source.title ? source.url : ''}`, 'body', 64 + (i % 2) * 590, 230 + Math.floor(i / 2) * 94, 550, 82, palette.text, 17)));
    else pushSubtitle(64, 260, 1100, 180);
  } else if (preset.kind === 'chart' && chart) {
    pushTitle(64, 98, 1120, 110, 48); pushSubtitle(64, 215, 1120, 60);
    const alongside = slide.metadata.storyComposition && cards.length;
    const next = copy(chart);
    next.position = { mode: 'absolute', x: 64, y: alongside ? 235 : 302 };
    next.size = { w: alongside ? 640 : 1152, h: alongside ? 375 : 320 };
    next.style = { color: readableText(palette.card), backgroundColor: palette.card };
    elements.push(next);
    if (alongside) cards.forEach((card, i) => pushCard(card, 724, 235 + i * (378 / cards.length), 492, 378 / cards.length - 8, i));
  } else if (preset.kind === 'split' && cards.length) {
    if (slide.metadata.storyComposition) {
      pushTitle(64, 96, 1120, 118, 54);
      const featured = cards[0];
      const support = cards.slice(1);
      const leftWidth = 550;
      const top = 232;
      const height = 377;
      pushCard(featured, 64, top, leftWidth, height, 0);
      const panel = elements.at(-1);
      if (panel) {
        panel.style.backgroundColor = tint(palette.primary, palette.card, 0.9);
        panel.style.color = readableText(String(panel.style.backgroundColor));
        panel.style.fontSize = 26;
        panel.style.bodyFontSize = 20;
        panel.style.padding = [30, 30, 30, 30];
      }
      const gap = 14;
      const rowHeight = (height - gap * (support.length - 1)) / Math.max(1, support.length);
      support.forEach((card, i) => pushCard(card, 638, top + i * (rowHeight + gap), 578, rowHeight, i + 1));
    } else {
      pushTitle(64, 170, 530, 205, 58); pushSubtitle(66, 400, 510, 150);
      cards.slice(0, 3).forEach((card, i) => pushCard(card, 680, 130 + i * 166, 536, 144, i));
    }
  } else if (preset.id === 'summary' && slide.metadata.storyComposition && cards.length) {
    pushTitle(64, 96, 1152, 110, 54);
    const gap = 18, width = (1152 - (cards.length - 1) * gap) / cards.length;
    cards.forEach((card, i) => {
      const x = 64 + i * (width + gap);
      elements.push(element('shape', { kind: 'shape', shape: 'rect' }, x, 232, width, 5, { backgroundColor: palette.primary }, { decorative: true }));
      pushCard(card, x, 250, width, 356, i);
    });
  } else {
    pushTitle(64, 100, 1152, 128, 48); pushSubtitle(64, 236, 1100, 70);
    const selected = preset.kind === 'metrics' && metricCards.length ? metricCards : cards;
    const columns = slide.metadata.storyComposition && selected.length === 4 ? 2 : Math.min(preset.columns || 2, Math.max(1, selected.length));
    grid(selected, columns, slide.metadata.storyComposition ? 248 : 340, slide.metadata.storyComposition ? 362 : 278);
    if (!selected.length && value('body') && value('body') !== subtitle) elements.push(text(value('body'), 'body', 64, 345, 1050, 250, palette.text, 26));
  }
  const sourceHost = slide.sources?.[0]?.url;
  const footer = [
    text(brand?.brandName || 'Vistara Studio', 'caption', 64, 671, 360, 20, palette.muted, 10),
    ...(sourceHost ? [text(sourceHost.replace(/^https?:\/\/(www\.)?/, '').slice(0, 90), 'caption', 430, 671, 650, 20, palette.muted, 10, { textAlign: 'right' })] : []),
    text(pageNumber(index, total), 'caption', 1115, 671, 101, 20, palette.muted, 10, { textAlign: 'right' }),
  ];
  footer.forEach((el, i) => { el.metadata.generatedDecoration = true; if (i === footer.length - 1) el.metadata.pageNumber = true; });
  const used = new Set(elements.map(el => el.id));
  for (const el of elements) if (el.content.kind === 'text') {
    const contentRole = el.content.role;
    const previous = !['caption', 'body'].includes(contentRole) ? role(contentRole === 'subtitle' ? subtitleRole : contentRole) : null;
    if (previous && !used.has(previous.id)) { el.id = previous.id; used.add(previous.id); }
  }
  for (const old of original) {
    if (used.has(old.id) || absorbed.has(old.id) || old.metadata.generatedDecoration || (old.metadata.designed && (old.metadata.decorative && old.type === 'shape' || old.metadata.semantic === 'logo'))) continue;
    if (!input.composition && old.content.kind === 'button' && old.content.href === '#') continue;
    // Content from an already edited slide must survive a layout change. The first
    // composition of legacy rows retains the curated layout's visual hierarchy.
    if (input.composition || old.position.mode === 'absolute' || !['text', 'card', 'image'].includes(old.type)) elements.push(old);
  }
  elements.push(...footer);
  return { ...slide, composition: preset.id, background: { type: 'solid', value: palette.bg }, elements, metadata: { ...slide.metadata, designVariant: variant, designedV2: true } };
}

const pageNumber = (index: number, total: number) => `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
export function renumberSlides(spec: PresentationSpec): PresentationSpec {
  let changed = false;
  const slides = spec.slides.map((slide, index) => {
    const value = pageNumber(index, spec.slides.length);
    if (!slide.elements.some(el => el.metadata.pageNumber && el.content.kind === 'text' && el.content.text !== value)) return slide;
    changed = true;
    return { ...slide, elements: slide.elements.map(el => el.metadata.pageNumber && el.content.kind === 'text' ? { ...el, content: { ...el.content, text: value } } : el) };
  });
  return changed ? { ...spec, slides } : spec;
}

export function chooseComposition(slide: SlideSpec, index: number, total: number): string {
  if (index === 0 || slide.section === 'hero') return 'cover';
  if (slide.metadata.referencePage) return 'sources';
  const storyComposition = slide.metadata.storyComposition;
  if (typeof storyComposition === 'string' && COMPOSITIONS.some(preset => preset.id === storyComposition)) return storyComposition;
  if (slide.section === 'cta' || index === total - 1) return 'conclusion';
  if (slide.elements.some(el => el.content.kind === 'chart' && el.content.series.length)) return 'data';
  if (slide.elements.some(el => el.content.kind === 'image' && el.content.src)) return index % 2 ? 'image-story' : 'case-study';
  const map: Record<string, string> = { workflow: 'process', timeline: 'timeline', architecture: 'architecture', comparison: 'comparison-two', differentiation: 'comparison-three', metrics: 'dashboard', impact: 'metric', features: 'features', product: 'features', services: 'features', overview: 'overview', market: 'market', future: 'roadmap', audience: 'comparison-three', benefits: 'summary' };
  return map[slide.section] || (index % 2 ? 'findings' : 'overview');
}

export function designPresentation(spec: PresentationSpec, brand: BrandKit, mood: Parameters<typeof themeFromBrand>[1] = 'brand'): PresentationSpec {
  const next = copy(spec); next.brand = copy(brand); next.theme = themeFromBrand(brand, mood);
  next.schemaVersion = 'presentation.v2'; next.meta.editorVersion = 2;
  next.slides = next.slides.map((slide, index) => {
    const composition = chooseComposition(slide, index, next.slides.length);
    const restrainedCover = index === 0 && (brand.visualStyle === 'minimal' || next.meta.purpose === 'product-demo');
    const variant = index > 0 && next.slides.some(item => item.metadata.storyComposition)
      ? (index % 3 === 0 ? 4 : 1)
      : index % 5;
    return composeSlide(slide, next.theme, composition, index, next.slides.length, brand, restrainedCover ? 5 : variant);
  });
  return repairDesign(next);
}

export function brandForLegacy(name: string, url: string, primary?: string): BrandKit {
  return deriveBrandKit({ name, url, signals: primary && colorHex(primary) ? [{ value: primary, role: 'css-primary', sourceUrl: url, method: 'Previously saved presentation theme; not a new brand measurement', confidence: 0.4 }] : [] });
}

export interface DesignIssue { slideId: string; elementId?: string; kind: 'overflow' | 'contrast' | 'overlap' | 'density' | 'repetition'; message: string; }
export function inspectDesign(spec: PresentationSpec): DesignIssue[] {
  const issues: DesignIssue[] = [], titles = new Set<string>();
  for (const slide of spec.slides) {
    const title = slide.elements.find(el => el.content.kind === 'text' && el.content.role === 'title');
    const heading = title?.content.kind === 'text' ? title.content.text.toLowerCase().trim() : '';
    if (heading && titles.has(heading)) issues.push({ slideId: slide.id, kind: 'repetition', message: 'Repeated slide title' });
    titles.add(heading);
    const bg = slide.background.type === 'solid' ? slide.background.value : spec.theme.colors.bg;
    const content = slide.elements.filter(el => !el.hidden && !el.metadata.decorative && !['shape', 'image'].includes(el.type));
    for (const el of content) {
      const x = el.position.x || 0, y = el.position.y || 0, w = typeof el.size.w === 'number' ? el.size.w : 0, h = typeof el.size.h === 'number' ? el.size.h : 0;
      if (el.position.mode === 'absolute' && (x < 0 || y < 0 || x + w > spec.canvas.width + 1 || y + h > spec.canvas.height + 1)) issues.push({ slideId: slide.id, elementId: el.id, kind: 'overflow', message: 'Element is outside the slide' });
      if (el.content.kind === 'text' && colorHex(el.style.color) && contrast(String(el.style.color), colorHex(el.style.backgroundColor) || bg) < (Number(el.style.fontSize || 16) >= 24 ? 3 : 4.5)) issues.push({ slideId: slide.id, elementId: el.id, kind: 'contrast', message: 'Text has low contrast' });
      if (el.content.kind === 'text' && w && h && fitFont(el.content.text, w, h, Number(el.style.fontSize || 17), 1, Number(el.style.lineHeight || 1.4)) < Number(el.style.fontSize || 17) - 1) issues.push({ slideId: slide.id, elementId: el.id, kind: 'overflow', message: 'Text may overflow its box' });
    }
    for (let i = 0; i < content.length; i++) for (let j = i + 1; j < content.length; j++) {
      const a = content[i], b = content[j];
      if (a.position.mode !== 'absolute' || b.position.mode !== 'absolute') continue;
      const width = Math.min((a.position.x || 0) + Number(a.size.w || 0), (b.position.x || 0) + Number(b.size.w || 0)) - Math.max(a.position.x || 0, b.position.x || 0);
      const height = Math.min((a.position.y || 0) + Number(a.size.h || 0), (b.position.y || 0) + Number(b.size.h || 0)) - Math.max(a.position.y || 0, b.position.y || 0);
      if (width > 5 && height > 5) issues.push({ slideId: slide.id, elementId: b.id, kind: 'overlap', message: 'Content elements overlap' });
    }
  }
  return issues;
}
export function repairDesign(spec: PresentationSpec): PresentationSpec {
  const next = copy(spec);
  for (const slide of next.slides) for (const el of slide.elements) {
    if (el.locked || el.metadata.decorative || el.position.mode !== 'absolute') continue;
    if (typeof el.size.w === 'number') { el.size.w = Math.min(el.size.w, next.canvas.width); el.position.x = Math.max(0, Math.min(el.position.x || 0, next.canvas.width - el.size.w)); }
    if (typeof el.size.h === 'number') { el.size.h = Math.min(el.size.h, next.canvas.height); el.position.y = Math.max(0, Math.min(el.position.y || 0, next.canvas.height - el.size.h)); }
    if (el.content.kind === 'text') {
      const bg = colorHex(el.style.backgroundColor) || (slide.background.type === 'solid' ? slide.background.value : next.theme.colors.bg);
      if (colorHex(el.style.color) && contrast(String(el.style.color), bg) < 4.5) el.style.color = readableText(bg);
      if (typeof el.size.w === 'number' && typeof el.size.h === 'number') el.style.fontSize = fitFont(el.content.text, el.size.w, el.size.h, Number(el.style.fontSize || 18), el.content.role === 'caption' ? 10 : 12, Number(el.style.lineHeight || 1.4));
    }
  }
  const issues = inspectDesign(next);
  for (const slide of next.slides) slide.validation = { checkedAt: new Date().toISOString(), score: Math.max(0, 100 - issues.filter(issue => issue.slideId === slide.id).length * 12), issues: issues.filter(issue => issue.slideId === slide.id).map(issue => issue.message) };
  return next;
}

/** Recolour without changing coordinates, copy or manual custom colours. */
export function applyTheme(spec: PresentationSpec, theme: ThemeSpec, slideId?: string): PresentationSpec {
  const next = copy(spec);
  if (!slideId) next.theme = copy(theme);
  for (const [index, slide] of next.slides.entries()) {
    if (slideId && slide.id !== slideId) continue;
    const oldTheme = { ...spec.theme, ...slide.themeOverride };
    const variant = Number(slide.metadata.designVariant ?? index % 5);
    const before = slidePalette(oldTheme, variant), after = slidePalette(theme, variant);
    if (slideId) slide.themeOverride = { colors: copy(theme.colors), typography: copy(theme.typography) };
    else delete slide.themeOverride;
    if (slide.composition && (slide.background.type === 'theme' || (slide.background.type === 'solid' && colorHex(slide.background.value) === colorHex(before.bg)))) {
      slide.background = { type: 'solid', value: after.bg };
    }
    const walk = (els: SlideElement[]) => {
      for (const el of els) {
        if (el.metadata.designed && !el.locked && !el.metadata.customColour) {
          if (el.content.kind === 'text') {
            const role = el.content.role;
            const bg = colorHex(el.style.backgroundColor) || (slide.background.type === 'solid' ? slide.background.value : theme.colors.bg);
            const color = role === 'kicker' ? after.accent : role === 'subtitle' || role === 'caption' ? after.muted : after.text;
            el.style.color = contrast(color, bg) >= 4.5 ? color : readableText(bg);
          } else if (el.content.kind === 'card' || el.content.kind === 'diagram' || el.content.kind === 'chart') {
            el.style.backgroundColor = after.card;
            el.style.color = readableText(after.card);
            if (el.style.borderColor) el.style.borderColor = after.line;
          }
        }
        if (el.content.kind === 'group') walk(el.content.children);
      }
    };
    walk(slide.elements);
  }
  return next;
}
