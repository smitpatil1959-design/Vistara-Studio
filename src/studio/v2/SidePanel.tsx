import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowRight, BarChart3, BookOpen, Box, Check, Circle, Clock3, Cloud, Code2, Compass, Database, ExternalLink, FileText, Flag, Globe, Grid2X2, Heart, ImagePlus, Layers3, LineChart, Link2, Lock, Minus, PanelLeftClose, PieChart, Plus, Search, ShieldCheck, Sparkles, Square, Star, Target, Triangle, User, Zap } from 'lucide-react';
import type { AssetReference, BrandKit, PresentationSpec, ShapeKind, SlideElement, SlideSpec, ThemeMood } from '../../deck-spec';
import { applyTheme, COMPOSITIONS, composeSlide, newSpecId, readableText, repairDesign, themeFromBrand, tint, verifiedChartPoints } from '../../deck-spec';
import type { Project } from '../../types';
import { getResearchClaims } from '../../services';
import { ColorField, Field } from './Inspector';
import { EDITOR_FONTS } from './tools';
import type { ToolId } from './tools';
import { TOOLS } from './tools';

type Insert = (kind: SlideElement['type'], configure?: (element: SlideElement) => void, label?: string) => void;
interface Props { tool: ToolId; doc: PresentationSpec; slide: SlideSpec; index: number; project: Project; onCommit: (doc: PresentationSpec, label?: string) => void; onInsert: Insert; onAddSlide: (preset?: string) => void; onSlide: (index: number) => void; onAssets: () => void; onImage: (asset: AssetReference, alt: string) => void; onClose: () => void; assistant?: React.ReactNode; }

const ICONS = [['sparkles', Sparkles], ['star', Star], ['globe', Globe], ['target', Target], ['zap', Zap], ['shield-check', ShieldCheck], ['cloud', Cloud], ['book-open', BookOpen], ['code-2', Code2], ['flag', Flag], ['database', Database], ['box', Box], ['compass', Compass], ['heart', Heart], ['user', User], ['lock', Lock], ['check', Check], ['arrow-right', ArrowRight], ['clock-3', Clock3], ['link-2', Link2]] as const;
const THEME_PRESETS: { mood: ThemeMood; name: string; tagline: string }[] = [{ mood: 'brand', name: 'Signature', tagline: 'The detected brand, in focus' }, { mood: 'editorial', name: 'Editorial', tagline: 'Serif headlines and open space' }, { mood: 'contrast', name: 'Night Studio', tagline: 'Dark surfaces and bold accents' }, { mood: 'soft', name: 'Soft Paper', tagline: 'A light, tinted reading canvas' }];

export default function SidePanel({ tool, doc, slide, index, project, onCommit, onInsert, onAddSlide, onSlide, onAssets, onImage, onClose, assistant }: Props) {
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const title = TOOLS.find(item => item.id === tool)?.name || 'Studio';
  const applyLayout = (id: string) => {
    const composed = composeSlide(slide, { ...doc.theme, ...slide.themeOverride }, id, index, doc.slides.length, doc.brand, Number(slide.metadata.designVariant ?? index % 5));
    const checked = repairDesign({ ...doc, slides: [composed] }).slides[0];
    onCommit({ ...doc, slides: doc.slides.map(item => item.id === slide.id ? checked : item) }, `Layout: ${COMPOSITIONS.find(preset => preset.id === id)?.name || id}`);
  };
  const thumbnail = (kind: string) => <div className={`v-layout-art layout-${kind}`} aria-hidden><i /><i /><i /><i /><i /></div>;
  const detected = project.analysis?.brandKit || doc.brand;
  return <aside className="v-sidepanel" aria-label={`${title} panel`}>
    <div className="v-panel-heading"><div><small>WORKSPACE</small><h2>{title}</h2></div><button className="v-icon" aria-label="Close tool panel" onClick={onClose}><PanelLeftClose size={17} /></button></div>
    <div className="v-sidepanel-scroll">
      {['layouts', 'icons', 'slides', 'images'].includes(tool) && <label className="v-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} aria-label={`Search ${title.toLowerCase()}`} /></label>}
      {tool === 'slides' && <><div className="v-panel-kicker"><span>STORY OUTLINE</span><span>{doc.slides.length} slides</span></div><div className="v-outline">{doc.slides.map((item, i) => ({ item, i })).filter(({ item }) => item.label.toLowerCase().includes(search) || item.elements.some(el => el.content.kind === 'text' && el.content.text.toLowerCase().includes(search))).map(({ item, i }) => { const title = item.elements.find(el => el.content.kind === 'text' && el.content.role === 'title'); return <button key={item.id} className={i === index ? 'is-active' : ''} onClick={() => onSlide(i)}><span>{String(i + 1).padStart(2, '0')}</span><div><strong>{title?.content.kind === 'text' ? title.content.text.replace(/\*/g, '') : item.label}</strong><small>{item.sources?.length ? `${item.sources.length} source${item.sources.length === 1 ? '' : 's'}` : item.label}</small></div>{i === index && <ArrowDownRight size={14} />}</button>; })}</div><button className="v-button v-wide v-dashed" onClick={() => onAddSlide()}><Plus size={15} /> Add slide</button></>}
      {tool === 'layouts' && <><p className="v-help">Give this slide a new structure while keeping its content and sources.</p><div className="v-layouts">{COMPOSITIONS.filter(preset => `${preset.name} ${preset.description}`.toLowerCase().includes(search)).map(preset => <button key={preset.id} aria-pressed={slide.composition === preset.id} onClick={() => applyLayout(preset.id)} title={preset.description}>{thumbnail(preset.kind)}<span>{preset.name}</span></button>)}</div></>}
      {tool === 'templates' && <><p className="v-help">Apply a coordinated design to the whole presentation.</p>{doc.brand && THEME_PRESETS.map(preset => { const theme = themeFromBrand(doc.brand!, preset.mood); return <button key={preset.mood} className="v-template" onClick={() => onCommit(applyTheme(doc, theme), `${preset.name} theme`)}><span className="v-template-art" style={{ background: theme.colors.bg, color: theme.colors.text }}><span style={{ background: theme.colors.accent }} /><b style={{ fontFamily: theme.typography.headingFont }}>Aa</b><i style={{ background: theme.colors.accent2 }} /></span><strong>{preset.name}</strong><small>{preset.tagline}</small></button>; })}</>}
      {tool === 'text' && <><p className="v-help">Add an editable text box. Double-click any text on the canvas to edit it.</p>{([['Heading', 'title', 56], ['Subheading', 'subtitle', 34], ['Body text', 'body', 22], ['Caption', 'caption', 14]] as const).map(([label, role, size]) => <button className="v-type-choice" key={role} onClick={() => onInsert('text', element => { element.content = { kind: 'text', text: label, role }; element.style.fontSize = size; element.size = { w: role === 'title' ? 650 : 440, h: size * 1.5 }; }, `Add ${label.toLowerCase()}`)}><span style={{ fontSize: Math.min(32, size), fontWeight: role === 'title' ? 680 : 500 }}>{label}</span><Plus size={15} /></button>)}</>}
      {tool === 'images' && <><button className="v-button v-wide v-primary" onClick={onAssets}><ImagePlus size={15} /> Uploads & captures</button><div className="v-panel-kicker"><span>FROM THE WEBSITE</span></div><div className="v-images">{(project.analysis?.images || []).filter(image => /^https?:\/\//i.test(image.src) && `${image.alt || ''} ${image.src}`.toLowerCase().includes(search)).slice(0, 30).map((image, i) => <button key={image.src + i} onClick={() => onImage({ id: newSpecId(), url: image.src, sourceUrl: project.url, projectId: project.id, license: 'Not supplied by source', relevance: 'Website image' }, image.alt || 'Website image')} title={image.alt || image.src}><img src={image.src} loading="lazy" alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /><span>{image.alt || 'Website image'}</span></button>)}</div>{!project.analysis?.images?.length && <p className="v-help">No site images were captured. You can upload an image from your library.</p>}<p className="v-help">Website image rights are not verified. Use assets you have permission to reuse.</p></>}
      {tool === 'elements' && <div className="v-tools-grid">{([['card', 'Card', Layers3], ['card', 'Metric card', BarChart3], ['card', 'Callout', Flag], ['table', 'Table', Grid2X2], ['diagram', 'Timeline', Clock3], ['diagram', 'Process', ArrowRight], ['button', 'Link button', Link2], ['video', 'Video', FileText]] as const).map(([type, label, Icon]) => <button key={label} onClick={() => onInsert(type, el => { if (el.content.kind === 'diagram' && label === 'Timeline') el.content.layout = 'timeline'; if (el.content.kind === 'card' && label === 'Metric card') { el.content.title = 'Metric'; el.content.body = 'Add a measurement and its context'; el.content.icon = null; el.metadata.semantic = 'metric'; } if (el.content.kind === 'card' && label === 'Callout') { el.content.title = 'Key takeaway'; el.content.icon = 'flag'; el.metadata.semantic = 'callout'; } }, `Add ${label.toLowerCase()}`)}><Icon size={23} /><span>{label}</span></button>)}</div>}
      {tool === 'shapes' && <div className="v-tools-grid">{([['rect', 'Rectangle', Square], ['circle', 'Circle', Circle], ['pill', 'Pill', Minus], ['line', 'Line', Minus], ['divider', 'Divider', PanelLeftClose], ['glow', 'Accent glow', Sparkles]] as const).map(([shape, label, Icon]) => <button key={shape} onClick={() => onInsert('shape', element => { element.content = { kind: 'shape', shape: shape as ShapeKind }; element.size = { w: shape === 'circle' ? 136 : 240, h: ['line', 'divider'].includes(shape) ? 5 : shape === 'pill' ? 58 : 136 }; element.style.backgroundColor = doc.theme.colors.accent; }, `Add ${label.toLowerCase()}`)}><Icon size={24} /><span>{label}</span></button>)}</div>}
      {tool === 'icons' && <div className="v-icons-grid">{ICONS.filter(([name]) => name.includes(search)).map(([name, Icon]) => <button aria-label={`Add ${name} icon`} title={name} key={name} onClick={() => onInsert('icon', element => { element.content = { kind: 'icon', name, pack: 'lucide' }; element.size = { w: 48, h: 48 }; }, `Add ${name} icon`)}><Icon size={21} /></button>)}</div>}
      {tool === 'charts' && <><div className="v-tools-grid">{([['bars', 'Bar', BarChart3], ['line', 'Line', LineChart], ['area', 'Area', Triangle], ['pie', 'Pie', PieChart], ['donut', 'Donut', Circle], ['progress', 'Progress', Minus]] as const).map(([chart, label, Icon]) => <button key={chart} onClick={() => onInsert('chart', element => { if (element.content.kind === 'chart') element.content.chart = chart; }, `Add ${label.toLowerCase()} chart`)}><Icon size={23} /><span>{label}</span></button>)}</div><VerifiedData projectId={project.id} onInsert={onInsert} /></>}
      {tool === 'brand' && doc.brand && <BrandPanel doc={doc} slide={slide} detected={detected || doc.brand} onCommit={onCommit} onImage={onImage} project={project} />}
      {tool === 'assistant' && assistant}
    </div>
  </aside>;
}

function VerifiedData({ projectId, onInsert }: { projectId: string; onInsert: Insert }) {
  const [points, setPoints] = useState<ReturnType<typeof verifiedChartPoints>>([]), [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; void getResearchClaims(projectId).then(({ claims }) => { if (active) setPoints(verifiedChartPoints(claims)); }).catch(() => {}).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [projectId]);
  const comparable = useMemo(() => { const units = [...new Set(points.map(point => point.unit))]; return units.map(unit => ({ unit, points: points.filter(point => point.unit === unit).slice(0, 6) })).filter(group => group.points.length > 1); }, [points]);
  return <div className="v-panel-block"><div className="v-panel-kicker"><span>FROM RESEARCH</span></div>{loading ? <p className="v-help">Checking source-backed numbers…</p> : comparable.length ? comparable.map(group => <button className="v-button v-wide" key={group.unit} onClick={() => onInsert('chart', element => { element.content = { kind: 'chart', chart: 'bars', series: group.points.map(({ label, value, sourceUrl }) => ({ label, value, sourceUrl })), axisLabel: group.unit, dataSource: 'verified', showValues: true, legend: true }; }, `Chart: ${group.unit}`)}><BarChart3 size={14} /> Chart {group.points.length} {group.unit} figures</button>) : <><p className="v-help">No comparable figures were found in this research. A diagram can explain the evidence without inventing numbers.</p><button className="v-button v-wide" onClick={() => onInsert('diagram', undefined, 'Add diagram')}><ArrowRight size={14} /> Add diagram instead</button></>}</div>;
}

function BrandPanel({ doc, slide, detected, onCommit, onImage, project }: { doc: PresentationSpec; slide: SlideSpec; detected: BrandKit; onCommit: Props['onCommit']; onImage: Props['onImage']; project: Project }) {
  const brand = doc.brand || detected;
  const [scope, setScope] = useState<'deck' | 'slide'>('deck');
  const target = scope === 'slide' ? slide.id : undefined;
  const theme = scope === 'slide' ? { ...doc.theme, ...slide.themeOverride } : doc.theme;
  const apply = (kit: BrandKit, label: string, mood: ThemeMood = 'brand') => {
    const styled = applyTheme(doc, themeFromBrand(kit, mood), target);
    onCommit(target ? styled : { ...styled, brand: kit }, label);
  };
  const colour = (key: keyof typeof theme.colors, value: string, label: string) => {
    const next = applyTheme(doc, { ...theme, colors: { ...theme.colors, [key]: value } }, target);
    if (!target && (key === 'accent' || key === 'accent2')) {
      next.brand = { ...brand, [key === 'accent' ? 'primaryColor' : 'secondaryColor']: value };
    }
    onCommit(next, label);
  };
  return <>
    <div className="v-brand-card">
      <div className="v-brand-mark" style={{ background: theme.colors.accent, color: readableText(theme.colors.accent) }}>{brand.brandName.slice(0, 1).toUpperCase()}</div>
      <strong>{brand.brandName}</strong>
      <small>{brand.isFallback ? 'Studio fallback palette' : `${Math.round(brand.confidence * 100)}% signal confidence`}</small>
      <div className="v-palette">{[...new Set([theme.colors.accent, theme.colors.accent2, ...brand.accentColors])].slice(0, 5).map(color => <i key={color} title={color} style={{ background: color }} />)}</div>
    </div>
    <div className="v-segment">
      <button aria-pressed={scope === 'deck'} onClick={() => setScope('deck')}>Whole deck</button>
      <button aria-pressed={scope === 'slide'} onClick={() => setScope('slide')}>This slide</button>
    </div>
    <ColorField label="Primary colour" value={theme.colors.accent} onChange={value => colour('accent', value, 'Brand primary colour')} />
    <ColorField label="Secondary colour" value={theme.colors.accent2} onChange={value => colour('accent2', value, 'Brand secondary colour')} />
    <ColorField label="Slide surface" value={theme.colors.bg} onChange={value => colour('bg', value, 'Theme surface')} />
    <ColorField label="Theme text" value={theme.colors.text} onChange={value => colour('text', value, 'Theme text')} />
    {scope === 'deck' && <Field label="Brand name" value={brand.brandName} onCommit={value => onCommit({ ...doc, brand: { ...brand, brandName: value.trim() || brand.brandName } }, 'Brand name')} />}
    {(['headingFont', 'bodyFont'] as const).map(key => {
      const label = key === 'headingFont' ? 'Heading font' : 'Body font';
      return <label className="v-field" key={key}><span>{label}</span><select aria-label={label} value={theme.typography[key]} onChange={event => onCommit(applyTheme(doc, { ...theme, typography: { ...theme.typography, [key]: event.target.value } }, target), label)}>
        {[...new Set([theme.typography[key], ...EDITOR_FONTS])].map(font => <option key={font}>{font}</option>)}
      </select></label>;
    })}
    <button className="v-button v-wide v-primary" onClick={() => apply(detected, 'Apply detected brand')}><Sparkles size={14} /> Apply detected brand</button>
    <button className="v-button v-wide" onClick={() => apply({ ...brand, primaryColor: brand.secondaryColor, secondaryColor: tint(brand.primaryColor, '#24352A', 0.22) }, 'Alternate brand palette', 'soft')}>Try alternate palette</button>
    <button className="v-button v-wide" onClick={() => apply(detected, 'Reset original brand theme')}>Reset original theme</button>
    {brand.logoUrl && <button className="v-button v-wide" onClick={() => onImage({ id: newSpecId(), url: brand.logoUrl!, sourceUrl: project.url, projectId: project.id, relevance: 'Observed website logo' }, `${brand.brandName} logo`)}><ImagePlus size={14} /> Add brand logo</button>}
    <div className="v-panel-block">
      <div className="v-panel-kicker"><span>OBSERVED SIGNALS</span></div>
      {brand.sources.slice(0, 5).map((signal, i) => <a className="v-signal" key={i} href={signal.sourceUrl} target="_blank" rel="noreferrer"><i style={{ background: signal.value }} /><span>{signal.method}</span><ExternalLink size={12} /></a>)}
      {!brand.sources.length && <p className="v-help">No reliable brand signal was available. This palette comes from Studio.</p>}
    </div>
  </>;
}
