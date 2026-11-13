import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Copy, Grip, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { SpecCanvas } from '../../components/deck/SpecStage';
import type { PresentationSpec } from '../../deck-spec';

function Thumbnail({ doc, index }: { doc: PresentationSpec; index: number }) {
  const ref = useRef<HTMLDivElement>(null), [shown, setShown] = useState(index < 5);
  useEffect(() => {
    if (shown || !ref.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setShown(true); observer.disconnect(); } }, { rootMargin: '120px' });
    observer.observe(ref.current); return () => observer.disconnect();
  }, [shown]);
  return <div className="v-thumbnail-image" ref={ref} aria-hidden>{shown && <SpecCanvas spec={doc} index={index} />}</div>;
}
interface Props { doc: PresentationSpec; index: number; onSelect: (index: number) => void; onReorder: (from: number, to: number) => void; onDuplicate: (ids: string[]) => void; onDelete: (ids: string[]) => void; onAdd: () => void; }
export default function SlideNavigator({ doc, index, onSelect, onReorder, onDuplicate, onDelete, onAdd }: Props) {
  const [selected, setSelected] = useState<string[]>([]), [dragging, setDragging] = useState<string | null>(null), [over, setOver] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => { strip.current?.querySelector('.v-thumb.is-current')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [index]);
  useEffect(() => { if (!menu) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [menu]);
  const select = (i: number, event: React.MouseEvent) => {
    const id = doc.slides[i].id;
    if (event.shiftKey) { setSelected(doc.slides.slice(Math.min(index, i), Math.max(index, i) + 1).map(slide => slide.id)); }
    else if (event.ctrlKey || event.metaKey) setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, doc.slides[index].id, id]);
    else setSelected([]);
    onSelect(i);
  };
  const items = menu && selected.includes(menu.id) ? [...new Set(selected)] : menu ? [menu.id] : [];
  const menuIndex = doc.slides.findIndex(slide => slide.id === menu?.id);
  return <div className="v-slide-strip" aria-label="Slide navigator">
    <div className="v-strip-caption"><span><Grip size={13} /> PAGES</span><span>{selected.length > 1 ? `${new Set(selected).size} selected` : `${index + 1} of ${doc.slides.length}`}</span></div>
    <div className="v-slide-list" ref={strip}>
      {doc.slides.map((slide, i) => <div className={`v-thumb ${i === index ? 'is-current' : ''} ${selected.includes(slide.id) ? 'is-multi' : ''} ${over === slide.id ? 'is-drop' : ''} ${dragging === slide.id ? 'is-dragged' : ''}`} key={slide.id} draggable onDragStart={event => { event.dataTransfer.setData('text/plain', slide.id); event.dataTransfer.effectAllowed = 'move'; setDragging(slide.id); }} onDragEnd={() => { setDragging(null); setOver(null); }} onDragOver={event => { if (!dragging) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(slide.id); }} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const from = doc.slides.findIndex(item => item.id === id); if (from >= 0) onReorder(from, i); setDragging(null); setOver(null); }} onContextMenu={event => { event.preventDefault(); setMenu({ id: slide.id, x: event.clientX, y: event.clientY }); }}>
        <button aria-label={`Slide ${i + 1}: ${slide.label}`} aria-current={i === index ? 'page' : undefined} className="v-thumb-select" onClick={event => select(i, event)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); onSelect(Math.min(doc.slides.length - 1, Math.max(0, i + (event.key === 'ArrowRight' ? 1 : -1)))); } }}><Thumbnail doc={doc} index={i} /><span className="v-thumb-label"><b>{String(i + 1).padStart(2, '0')}</b><span>{slide.label}</span></span></button>
        <button className="v-thumb-more" aria-label={`Slide ${i + 1} actions`} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setMenu({ id: slide.id, x: rect.left, y: rect.top }); }}><MoreHorizontal size={15} /></button>
      </div>)}
      <button className="v-thumb-add" onClick={onAdd} aria-label="Add slide"><Plus size={22} /><span>Add page</span></button>
    </div>
    {menu && createPortal(<div className="v-menu-backdrop" onClick={() => setMenu(null)}><div role="menu" className="v-context-menu" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 208) }} onClick={event => event.stopPropagation()}>
      <button role="menuitem" onClick={() => { onDuplicate(items); setMenu(null); setSelected([]); }}><Copy size={15} /> Duplicate {items.length > 1 ? `${items.length} slides` : 'slide'}</button>
      <button role="menuitem" disabled={menuIndex <= 0} onClick={() => { onReorder(menuIndex, menuIndex - 1); setMenu(null); }}><ArrowLeft size={15} /> Move earlier</button>
      <button role="menuitem" disabled={menuIndex >= doc.slides.length - 1} onClick={() => { onReorder(menuIndex, menuIndex + 1); setMenu(null); }}><ArrowRight size={15} /> Move later</button>
      <button role="menuitem" disabled={items.length >= doc.slides.length} className="v-danger" onClick={() => { onDelete(items); setMenu(null); setSelected([]); }}><Trash2 size={15} /> Delete {items.length > 1 ? 'slides' : 'slide'}</button>
    </div></div>, window.document.body)}
  </div>;
}
