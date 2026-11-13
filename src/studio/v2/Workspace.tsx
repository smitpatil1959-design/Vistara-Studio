import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { AlignCenter, ArrowLeft, Bold, Check, ClipboardPaste, Cloud, Copy, Download, FileText, Grid3X3, Group, Hand, LayoutTemplate, Loader2, Lock, Minus, MoreHorizontal, MousePointer2, Palette, PanelRight, Play, Plus, Redo2, RotateCcw, Save, Share2, Sparkles, Trash2, Undo2, Ungroup, Unlock, X } from 'lucide-react';
import Logo from '../../components/layout/Logo';
import { getSlides, getVisibility, updateProject } from '../../services';
import { useToast } from '../../hooks/useToast';
import type { AssetReference, SlideElement } from '../../deck-spec';
import { addSlide, alignSelection, composeSlide, deleteElement, duplicateSelection, duplicateSlide, elementBox, groupSelection, makeElement, moveSelection, readableText, renewElementIds, reorderSlides, ungroupSelection, updateElement, updateSlide, validatePresentation } from '../../deck-spec';
import type { Project, Slide } from '../../types';
import AssetLibrary from '../AssetLibrary';
import ExportDialog from '../ExportDialog';
import SharePanel from '../SharePanel';
import CanvasWorkspace, { type CanvasHandle } from './CanvasWorkspace';
import Inspector, { TextAreaField } from './Inspector';
import SidePanel from './SidePanel';
import SlideNavigator from './SlideNavigator';
import { EDITOR_FONTS, TOOLS, type ToolId } from './tools';
import { useEditorDocument } from './useEditorDocument';
import AssistantPanel from './AssistantPanel';
import './workspace.css';

interface Props { project: Project; slides: Slide[]; onSlidesChange: (slides: Slide[]) => void; onProjectChange: (project: Project) => void; onBackToReport: () => void; }
type Menu = { kind: 'more' | 'selection'; x: number; y: number };

export default function Workspace({ project, onSlidesChange, onProjectChange, onBackToReport }: Props) {
  const navigation = useNavigate(), { toast, show } = useToast();
  const editor = useEditorDocument(project.id, project.name, project.url), doc = editor.document;
  const [slideId, setSlideId] = useState(''), [selected, setSelected] = useState<string[]>([]);
  const [tool, setTool] = useState<ToolId>('slides'), [showPanel, setShowPanel] = useState(() => window.innerWidth > 980), [showInspector, setShowInspector] = useState(() => window.innerWidth > 1070);
  const [zoom, setZoom] = useState<number | null>(null), [grid, setGrid] = useState(false), [hand, setHand] = useState(false), [notes, setNotes] = useState(false), [animate, setAnimate] = useState(false);
  const [share, setShare] = useState(false), [exportOpen, setExportOpen] = useState(false), [assets, setAssets] = useState<'insert' | 'image' | 'background' | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('unlisted'), [menu, setMenu] = useState<Menu | null>(null);
  const canvas = useRef<CanvasHandle>(null), clipboard = useRef<SlideElement[]>([]), animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { let active = true; void getVisibility(project.id).then(response => { if (active) setVisibility(response.visibility); }).catch(() => {}); return () => { active = false; }; }, [project.id]);
  useEffect(() => () => { if (animationTimer.current) clearTimeout(animationTimer.current); }, []);
  useEffect(() => {
    const compact = window.matchMedia('(max-width: 1040px)');
    const fit = (event: MediaQueryListEvent) => {
      if (event.matches) { setShowInspector(false); setShowPanel(false); }
    };
    compact.addEventListener('change', fit);
    return () => compact.removeEventListener('change', fit);
  }, []);
  const index = Math.max(0, doc?.slides.findIndex(slide => slide.id === slideId) || 0), slide = doc?.slides[index];
  const chosen = slide?.elements.filter(element => selected.includes(element.id)) || [];
  const single = chosen.length === 1 ? chosen[0] : null;
  const geometry = () => canvas.current?.geometry() || {};
  const openTool = (id: ToolId) => { setTool(id); setShowPanel(true); if (window.innerWidth < 1040) setShowInspector(false); };
  const selectSlide = (i: number) => { if (doc?.slides[i]) { setSlideId(doc.slides[i].id); setSelected([]); setAnimate(false); } };
  const selectElements = (ids: string[]) => setSelected(ids);
  const navigateTo = async (action: () => void) => { if (await editor.flush()) action(); };
  const report = () => { void navigateTo(() => { void getSlides(project.id).then(onSlidesChange).catch(() => {}); onBackToReport(); }); };
  const rename = (name: string) => {
    const value = name.trim().slice(0, 100);
    if (!doc || !value || value === doc.name) return;
    editor.commit({ ...doc, name: value }, 'Rename presentation');
    void updateProject(project.id, { name: value }).then(onProjectChange).catch(() => show('Presentation title changed; the project list could not be updated.'));
  };
  const insert = (type: SlideElement['type'], configure?: (element: SlideElement) => void, label = `Add ${type}`, asset?: AssetReference) => {
    if (!doc || !slide) return;
    const element = makeElement(type), bg = slide.background.type === 'solid' ? slide.background.value : doc.theme.colors.bg;
    element.animation = { preset: 'none', delayMs: 0 }; element.style.color = readableText(bg);
    if (type === 'text') { element.style.fontSize = 26; element.size = { w: 420, h: 70 }; }
    if (type === 'button') element.size = { w: 200, h: 48 };
    if (type === 'card' || type === 'table' || type === 'chart' || type === 'diagram') { element.style.backgroundColor = doc.theme.colors.surface; element.style.color = doc.theme.colors.text; }
    configure?.(element);
    const box = elementBox(element), map = geometry(), existing = slide.elements.filter(item => !item.hidden && !item.metadata.decorative).map(item => elementBox(item, map));
    const spots = [{ x: (doc.canvas.width - box.w) / 2, y: (doc.canvas.height - box.h) / 2 }, { x: 70, y: 460 }, { x: 70, y: 350 }, { x: 650, y: 360 }, { x: 80, y: 95 }];
    const spot = spots.find(point => point.x + box.w <= doc.canvas.width && point.y + box.h <= doc.canvas.height && !existing.some(item => point.x < item.x + item.w + 8 && point.x + box.w > item.x - 8 && point.y < item.y + item.h + 8 && point.y + box.h > item.y - 8)) || spots[0];
    element.position = { mode: 'absolute', x: Math.round(Math.max(0, spot.x)), y: Math.round(Math.max(0, spot.y)) };
    const nextSlide = { ...slide, elements: [...slide.elements, element] };
    editor.commit({ ...doc, slides: doc.slides.map(item => item.id === slide.id ? nextSlide : item), ...(asset ? { assets: [...(doc.assets || []).filter(item => item.url !== asset.url), asset] } : {}) }, label);
    setSelected([element.id]); if (window.innerWidth > 1070) setShowInspector(true);
  };
  const insertImage = (asset: AssetReference, alt: string, target = assets) => {
    if (!doc || !slide) return;
    const list = [...(doc.assets || []).filter(item => item.url !== asset.url), asset];
    if (target === 'background') editor.commit({ ...updateSlide(doc, slide.id, { background: { type: 'image', value: asset.url } }), assets: list }, 'Image background');
    else if (target === 'image' && single?.content.kind === 'image') editor.commit({ ...updateElement(doc, slide.id, single.id, { imageSrc: asset.url, imageAlt: alt, metadata: { assetId: asset.id } }), assets: list }, 'Replace image');
    else insert('image', element => { element.content = { kind: 'image', src: asset.url, alt, fit: /logo/i.test(alt) ? 'contain' : 'cover', frame: 'plain' }; element.metadata.assetId = asset.id; element.size = /logo/i.test(alt) ? { w: 190, h: 84 } : { w: 410, h: 250 }; }, 'Add image', asset);
    setAssets(null);
  };
  const addPage = (preset = 'insight') => {
    if (!doc) return;
    const next = addSlide(doc, 'custom', 'New slide');
    const item = next.spec.slides.at(-1)!;
    const subtitle = item.elements.find(element => element.content.kind === 'text' && element.content.role === 'subtitle');
    if (subtitle?.content.kind === 'text') subtitle.content.text = 'Add your message';
    next.spec.slides[next.spec.slides.length - 1] = composeSlide(item, doc.theme, preset, next.spec.slides.length - 1, next.spec.slides.length, doc.brand, 1);
    editor.commit(next.spec, 'Add slide'); setSlideId(next.newId); setSelected([]);
  };
  const duplicatePages = (ids: string[]) => { if (!doc) return; let next = doc, id = ''; for (const source of ids) { const result = duplicateSlide(next, source); next = result.spec; if (result.newId) id = result.newId; } editor.commit(next, 'Duplicate slide'); if (id) { setSlideId(id); setSelected([]); } };
  const removePages = (ids: string[]) => { if (!doc || ids.length >= doc.slides.length) return; const pages = doc.slides.filter(item => !ids.includes(item.id)); editor.commit({ ...doc, slides: pages }, 'Delete slide'); if (slide && ids.includes(slide.id)) { setSlideId(pages[Math.min(index, pages.length - 1)].id); setSelected([]); } };
  const duplicate = () => { if (!doc || !slide || !selected.length) return; const next = duplicateSelection(doc, slide.id, selected, geometry()); editor.commit(next.spec, 'Duplicate selection'); setSelected(next.ids); };
  const remove = () => { if (!doc || !slide) return; const unlocked = chosen.filter(item => !item.locked); if (!unlocked.length) return; let next = doc; for (const item of unlocked) next = deleteElement(next, slide.id, item.id); editor.commit(next, 'Delete selection'); setSelected([]); };
  const group = () => { if (!doc || !slide) return; const result = groupSelection(doc, slide.id, selected, geometry()); if (result.id) { editor.commit(result.spec, 'Group elements'); setSelected([result.id]); } };
  const ungroup = () => { if (!doc || !slide) return; const result = ungroupSelection(doc, slide.id, selected); if (result.ids.length) { editor.commit(result.spec, 'Ungroup elements'); setSelected(result.ids); } };
  const lock = () => { if (!doc || !slide || !chosen.length) return; const locked = !chosen.every(item => item.locked); let next = doc; for (const item of chosen) next = updateElement(next, slide.id, item.id, { locked }); editor.commit(next, locked ? 'Lock selection' : 'Unlock selection'); };
  const copy = () => {
    if (!doc || !slide || !selected.length) return;
    const map = geometry(); clipboard.current = chosen.map(element => { const box = elementBox(element, map); return { ...structuredClone(element), position: { ...element.position, mode: 'absolute', x: box.x, y: box.y }, size: { w: box.w, h: box.h } }; });
    void navigator.clipboard?.writeText(JSON.stringify({ vistaraElements: clipboard.current })).catch(() => {}); show(`${clipboard.current.length} element${clipboard.current.length === 1 ? '' : 's'} copied`);
  };
  const paste = (elements = clipboard.current) => {
    if (!doc || !slide || !elements.length) return;
    const copies = elements.slice(0, 40).map(item => { const next = renewElementIds(item), box = elementBox(next); next.position = { ...next.position, mode: 'absolute', x: Math.max(0, Math.min(doc.canvas.width - box.w, box.x + 18)), y: Math.max(0, Math.min(doc.canvas.height - box.h, box.y + 18)) }; next.locked = false; return next; });
    const next = { ...doc, slides: doc.slides.map(item => item.id === slide.id ? { ...item, elements: [...item.elements, ...copies] } : item) };
    if (!validatePresentation(next).valid) return show('This clipboard content could not be pasted.');
    editor.commit(next, 'Paste elements'); setSelected(copies.map(item => item.id));
  };
  const keyboard = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || (event.target as HTMLElement).closest('input,textarea,select,[contenteditable]')) return;
    const key = event.key.toLowerCase(), modifier = event.ctrlKey || event.metaKey;
    if (key === 'escape') { setMenu(null); setSelected([]); return; }
    if (modifier && key === 'z') { event.preventDefault(); if (event.shiftKey) editor.redo(); else editor.undo(); return; }
    if (modifier && key === 'y') { event.preventDefault(); editor.redo(); return; }
    if (modifier && key === 's') { event.preventDefault(); void editor.flush(); return; }
    if (modifier && key === '0') { event.preventDefault(); setZoom(null); return; }
    if (modifier && key === 'c' && selected.length) { event.preventDefault(); copy(); return; }
    if (modifier && key === 'd') { event.preventDefault(); if (event.shiftKey && slide) duplicatePages([slide.id]); else duplicate(); return; }
    if (modifier && key === 'g') { event.preventDefault(); if (event.shiftKey) ungroup(); else group(); return; }
    if (!doc || !slide) return;
    if (modifier && key === 'a') { event.preventDefault(); setSelected(slide.elements.filter(item => !item.hidden && !item.locked).map(item => item.id)); return; }
    if (key === 'delete' || key === 'backspace') { if (selected.length) { event.preventDefault(); remove(); } return; }
    if (key === 'pagedown' || key === 'pageup') { event.preventDefault(); selectSlide(Math.max(0, Math.min(doc.slides.length - 1, index + (key === 'pagedown' ? 1 : -1)))); return; }
    if (selected.length && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; editor.commit(moveSelection(doc, slide.id, selected, key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0, key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0, geometry()), 'Nudge selection'); }
  });
  const pasteEvent = useEffectEvent((event: ClipboardEvent) => {
    if ((event.target as HTMLElement).closest('input,textarea,[contenteditable]')) return;
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text.startsWith('{') && text.length < 250_000) { try { const value = JSON.parse(text); if (Array.isArray(value.vistaraElements)) { event.preventDefault(); paste(value.vistaraElements); return; } } catch { /* plain text */ } }
    if (text) { event.preventDefault(); insert('text', element => { if (element.content.kind === 'text') element.content.text = text.slice(0, 12000); }, 'Paste text'); }
    else if (clipboard.current.length) { event.preventDefault(); paste(); }
  });
  useEffect(() => {
    const key = (event: KeyboardEvent) => keyboard(event), onPaste = (event: ClipboardEvent) => pasteEvent(event);
    window.addEventListener('keydown', key); window.addEventListener('paste', onPaste);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('paste', onPaste); };
  }, []);
  const preview = () => { setSelected([]); setAnimate(true); if (animationTimer.current) clearTimeout(animationTimer.current); animationTimer.current = setTimeout(() => setAnimate(false), 2400); };
  const download = () => { if (!doc) return; const link = window.document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })); link.download = `${doc.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-vistara.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); };

  if (!doc || !slide) return <div className="v-editor-loading"><Logo className="mx-auto" />{editor.error ? <><p role="alert">{editor.error}</p><button className="v-button" onClick={() => void editor.reload()}><RotateCcw size={14} /> Try again</button><button className="v-button" onClick={onBackToReport}>Back to research</button></> : <p>Opening your workspace…</p>}</div>;
  const status = editor.saveState === 'saving' ? 'Saving…' : editor.saveState === 'dirty' ? 'Unsaved' : editor.saveState === 'error' ? 'Save failed' : 'Saved';
  const titleFont = single?.style.fontFamily || (single?.content.kind === 'text' && single.content.role === 'title' ? doc.theme.typography.headingFont : doc.theme.typography.bodyFont);
  return <div className="v-editor" data-testid="vistara-editor">
    <header className="v-top">
      <Link className="v-wordmark" to="/dashboard" aria-label="All presentations" onClick={event => { event.preventDefault(); void navigateTo(() => navigation('/dashboard')); }}><Logo size={29} withWord={false} /><span>Vistara Studio</span></Link><i className="v-divider" />
      <div className="v-title-block"><input className="v-title-input" key={doc.name} aria-label="Presentation title" defaultValue={doc.name} onBlur={event => rename(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span className={`v-save ${status === 'Saved' ? 'is-saved' : status === 'Save failed' ? 'is-error' : ''}`} title={`${status} · version ${editor.version}`} role="status">{status === 'Saved' ? <Check size={14} /> : status === 'Saving…' ? <Loader2 size={14} className="v-spinning" /> : <Cloud size={14} />}<span>{status}</span></span></div>
      <div className="v-undo"><button className="v-icon" aria-label="Undo" title="Undo (Ctrl / Cmd Z)" disabled={!editor.canUndo} onClick={editor.undo}><Undo2 size={17} /></button><button className="v-icon" aria-label="Redo" title="Redo (Ctrl / Cmd Shift Z)" disabled={!editor.canRedo} onClick={editor.redo}><Redo2 size={17} /></button></div><i className="v-divider" />
      <div className="v-top-actions"><button className="v-button v-hide-tablet" onClick={() => openTool('templates')}><LayoutTemplate size={15} /><span>Theme</span></button><button className="v-button v-hide-tablet" onClick={() => openTool('brand')}><Palette size={15} /><span>Brand</span></button><button className="v-button v-hide-mobile" aria-label="Preview" aria-pressed={animate} onClick={preview}><Play size={14} /><span>Preview</span></button><button className="v-button" aria-label="Share" onClick={() => void navigateTo(() => setShare(value => !value))}><Share2 size={14} /><span>Share</span></button><button className="v-button" aria-label="Export" onClick={() => void navigateTo(() => setExportOpen(true))}><Download size={15} /><span>Export</span></button><button className="v-button v-primary" aria-label="Present" onClick={() => void navigateTo(() => navigation(`/present/${project.id}?studio=1&slide=${index + 1}`))}><Play size={14} /><span>Present</span></button><button className="v-icon" aria-label="More actions" onClick={event => { const box = event.currentTarget.getBoundingClientRect(); setMenu({ kind: 'more', x: box.right - 205, y: box.bottom + 4 }); }}><MoreHorizontal size={19} /></button></div>
    </header>
    <div className="v-body">
      <nav className="v-dock" aria-label="Editor tools">{TOOLS.map(({ id, name, icon: Icon }) => <button key={id} title={name} aria-label={name} aria-pressed={showPanel && tool === id} onClick={() => showPanel && tool === id ? setShowPanel(false) : openTool(id)}><Icon size={19} /><span>{name}</span></button>)}</nav>
      {showPanel && <SidePanel key={tool} tool={tool} doc={doc} slide={slide} index={index} project={project} onCommit={editor.commit} onInsert={insert} onAddSlide={addPage} onSlide={selectSlide} onAssets={() => setAssets('insert')} onImage={(asset, alt) => insertImage(asset, alt, 'insert')} onClose={() => setShowPanel(false)} assistant={<AssistantPanel projectId={project.id} doc={doc} slideId={slide.id} selection={selected} onApply={(next, focus) => { editor.commit(next, 'Apply assistant proposal'); setSlideId(focus); setSelected([]); }} />} />}
      <main className="v-middle" aria-label="Slide workspace">
        <div className="v-context"><span className="v-context-label"><b>Slide {index + 1}</b><span> / {chosen.length ? `${chosen.length} selected` : slide.label}</span></span>
          {single?.content.kind === 'text' && <><select aria-label="Quick font family" value={titleFont} onChange={event => editor.commit(updateElement(doc, slide.id, single.id, { style: { fontFamily: event.target.value } }), 'Font family')} disabled={single.locked}>{[...new Set([titleFont, ...EDITOR_FONTS])].map(font => <option key={font}>{font}</option>)}</select><button className="v-icon" aria-label="Bold text" aria-pressed={(single.style.fontWeight || 500) >= 650} disabled={single.locked} onClick={() => editor.commit(updateElement(doc, slide.id, single.id, { style: { fontWeight: (single.style.fontWeight || 500) >= 650 ? 400 : 700 } }), 'Bold text')}><Bold size={15} /></button></>}
          {chosen.length ? <div className="v-tool-actions"><button className="v-icon" aria-label="Align selection center" onClick={() => editor.commit(alignSelection(doc, slide.id, selected, 'center', geometry()), 'Align center')}><AlignCenter size={16} /></button><button className="v-icon" aria-label="Duplicate selection" onClick={duplicate}><Copy size={15} /></button>{chosen.filter(item => !item.locked).length > 1 && <button className="v-icon" aria-label="Group selection" onClick={group}><Group size={16} /></button>}{chosen.some(item => item.content.kind === 'group' && !item.locked) && <button className="v-icon" aria-label="Ungroup selection" onClick={ungroup}><Ungroup size={16} /></button>}<button className="v-icon" aria-label={chosen.every(item => item.locked) ? 'Unlock selection' : 'Lock selection'} onClick={lock}>{chosen.every(item => item.locked) ? <Unlock size={15} /> : <Lock size={15} />}</button><button className="v-icon v-danger" aria-label="Delete selection" disabled={chosen.every(item => item.locked)} onClick={remove}><Trash2 size={15} /></button></div> : <button className="v-button v-hide-mobile" onClick={() => openTool('layouts')}><LayoutTemplate size={14} /> Layout</button>}
          <span className="v-context-spacer" /><button className="v-icon" aria-label="AI Assistant" onClick={() => openTool('assistant')}><Sparkles size={16} /></button><button className="v-icon" aria-label="Properties" aria-pressed={showInspector} onClick={() => { setShowInspector(value => !value); if (window.innerWidth < 1040) setShowPanel(false); }}><PanelRight size={16} /></button>
        </div>
        <CanvasWorkspace key={slide.id} ref={canvas} document={doc} index={index} selected={selected} onSelect={selectElements} onCommit={editor.commit} zoom={zoom} onZoom={setZoom} grid={grid} hand={hand} animate={animate} onContextMenu={point => setMenu({ kind: 'selection', ...point })} />
        {notes && <div className="v-notes"><TextAreaField label="Speaker notes" value={slide.notes || ''} rows={2} onCommit={value => editor.commit(updateSlide(doc, slide.id, { notes: value.slice(0, 8000) }), 'Speaker notes')} /></div>}
        <SlideNavigator doc={doc} index={index} onSelect={selectSlide} onReorder={(from, to) => editor.commit(reorderSlides(doc, from, to), 'Reorder slides')} onDuplicate={duplicatePages} onDelete={removePages} onAdd={() => addPage()} />
      </main>
      {showInspector && <Inspector doc={doc} slide={slide} selected={selected} geometry={geometry} onCommit={editor.commit} onSelect={selectElements} onBrowse={setAssets} onLayouts={() => openTool('layouts')} onClose={() => setShowInspector(false)} />}
    </div>
    <footer className="v-footer"><div className="v-footer-group"><button className="v-icon" aria-label="Select tool" aria-pressed={!hand} onClick={() => setHand(false)}><MousePointer2 size={15} /></button><button className="v-icon" aria-label="Pan tool" aria-pressed={hand} onClick={() => setHand(true)}><Hand size={15} /></button><button className="v-icon" aria-label="Snap grid" aria-pressed={grid} onClick={() => setGrid(value => !value)}><Grid3X3 size={15} /></button><span className="v-footer-caption" title={editor.lastEdit || 'Ready'}>{editor.lastEdit || 'Ready to edit'}</span></div><div className="v-footer-group"><button className="v-button v-hide-mobile" aria-pressed={notes} onClick={() => setNotes(value => !value)}><FileText size={13} /> Notes</button><button className="v-icon" aria-label="Zoom out" onClick={() => setZoom(Math.max(0.1, (zoom ?? 0.6) - 0.1))}><Minus size={15} /></button><input type="range" min="10" max="250" step="5" aria-label="Zoom level" value={Math.round((zoom ?? 0.6) * 100)} onChange={event => setZoom(Number(event.target.value) / 100)} /><button className="v-icon" aria-label="Zoom in" onClick={() => setZoom(Math.min(3, (zoom ?? 0.6) + 0.1))}><Plus size={15} /></button><button className="v-button" aria-label="Fit slide to viewport" onClick={() => setZoom(null)}>{zoom === null ? 'Fit' : `${Math.round(zoom * 100)}%`}</button></div></footer>
    {menu && createPortal(<div className="v-menu-backdrop" onClick={() => setMenu(null)}><div className="v-context-menu" role="menu" style={{ left: Math.max(6, Math.min(menu.x, window.innerWidth - 218)), top: Math.max(6, Math.min(menu.y, window.innerHeight - 265)) }} onClick={event => event.stopPropagation()}>{menu.kind === 'more' ? <><button role="menuitem" onClick={() => { setMenu(null); void editor.flush(); }}><Save size={15} /> Save now</button><button role="menuitem" onClick={() => { setMenu(null); download(); }}><Download size={15} /> Export editable document</button><button role="menuitem" onClick={() => { setMenu(null); setNotes(value => !value); }}><FileText size={15} /> Speaker notes</button><button role="menuitem" onClick={() => { setMenu(null); report(); }}><ArrowLeft size={15} /> Back to research</button></> : <><button role="menuitem" disabled={!selected.length} onClick={() => { copy(); setMenu(null); }}><Copy size={15} /> Copy</button><button role="menuitem" onClick={() => { paste(); setMenu(null); }}><ClipboardPaste size={15} /> Paste</button><button role="menuitem" disabled={!selected.length} onClick={() => { duplicate(); setMenu(null); }}><Copy size={15} /> Duplicate</button><button role="menuitem" disabled={chosen.filter(item => !item.locked).length < 2} onClick={() => { group(); setMenu(null); }}><Group size={15} /> Group</button><button role="menuitem" disabled={!chosen.some(item => item.content.kind === 'group' && !item.locked)} onClick={() => { ungroup(); setMenu(null); }}><Ungroup size={15} /> Ungroup</button><button role="menuitem" className="v-danger" disabled={!chosen.some(item => !item.locked)} onClick={() => { remove(); setMenu(null); }}><Trash2 size={15} /> Delete</button></>}</div></div>, window.document.body)}
    {share && <SharePanel projectId={project.id} visibility={visibility} onVisibility={setVisibility} onClose={() => setShare(false)} onToast={show} />}
    {exportOpen && <ExportDialog projectId={project.id} projectName={doc.name} origin={window.location.origin} onClose={() => setExportOpen(false)} onOpenPrint={() => navigation(`/present/${project.id}?print=1`)} />}
    {assets && <AssetLibrary projectId={project.id} title={assets === 'background' ? 'Background image' : 'Image library'} onClose={() => setAssets(null)} onPick={(url, asset) => insertImage({ id: asset.id, url, sourceUrl: asset.source_page ? new URL(asset.source_page, project.url).href : undefined, projectId: project.id, relevance: asset.kind === 'scan' ? 'Website capture' : 'Uploaded by the owner' }, asset.name)} />}
    {toast && <div className="v-dialog-toast" role="status"><Check size={14} />{toast}</div>}
    {editor.error && <div className="v-save-error" role="alert"><span>{editor.error}</span><button className="v-button" onClick={() => void editor.flush()}>Retry</button><button className="v-button" onClick={download}>Save copy</button><button className="v-icon" aria-label="Dismiss error" onClick={editor.clearError}><X size={14} /></button></div>}
  </div>;
}
