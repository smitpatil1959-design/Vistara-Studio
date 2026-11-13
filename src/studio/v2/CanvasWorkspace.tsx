import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Box, GeometryMap, Guide, PresentationSpec } from '../../deck-spec';
import { elementBox, moveSelection, resizeSelection, rotateSelection, selectionBox, snapPosition, updateElement } from '../../deck-spec';
import { SpecStage } from '../../components/deck/SpecStage';

export interface CanvasHandle { geometry: () => GeometryMap; }
interface Props {
  document: PresentationSpec; index: number; selected: string[]; onSelect: (ids: string[]) => void;
  onCommit: (doc: PresentationSpec, label?: string) => void; zoom: number | null; onZoom: (value: number | null) => void;
  grid: boolean; hand: boolean; animate: boolean; onContextMenu: (point: { x: number; y: number }) => void;
}
type Gesture = { mode: 'move' | 'resize' | 'rotate' | 'marquee' | 'pan'; x: number; y: number; clientX: number; clientY: number; ids: string[]; document: PresentationSpec; resolved: GeometryMap; box: Box; handle?: string; scrollX: number; scrollY: number; };

export default forwardRef<CanvasHandle, Props>(function CanvasWorkspace({ document, index, selected, onSelect, onCommit, zoom, onZoom, grid, hand, animate, onContextMenu }, forwardedRef) {
  const viewport = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null);
  const [available, setAvailable] = useState({ width: 900, height: 600 });
  const [preview, setPreview] = useState<PresentationSpec | null>(null), lastPreview = useRef<PresentationSpec | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]), [marquee, setMarquee] = useState<Box | null>(null), [space, setSpace] = useState(false);
  const [editing, setEditing] = useState<string | null>(null), textCancelled = useRef(false);
  const active = preview || document, slide = active.slides[index];
  const scale = zoom ?? Math.max(0.1, Math.min((available.width - 88) / document.canvas.width, (available.height - 70) / document.canvas.height, 1));
  useEffect(() => {
    const target = viewport.current; if (!target) return;
    const observer = new ResizeObserver(() => setAvailable({ width: target.clientWidth, height: target.clientHeight }));
    observer.observe(target); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const target = viewport.current; if (!target) return;
    const wheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); onZoom(Math.max(0.1, Math.min(3, scale * (event.deltaY > 0 ? 0.9 : 1.1)))); } };
    target.addEventListener('wheel', wheel, { passive: false }); return () => target.removeEventListener('wheel', wheel);
  }, [scale, onZoom]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === 'Space' && !(event.target as HTMLElement).closest('button,select,input,textarea,[contenteditable]')) { event.preventDefault(); setSpace(true); } };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space') setSpace(false); };
    const blur = () => setSpace(false);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  const point = (clientX: number, clientY: number) => { const rect = stage.current?.getBoundingClientRect(); return { x: rect ? (clientX - rect.left) / scale : 0, y: rect ? (clientY - rect.top) / scale : 0 }; };
  const geometry = useCallback((): GeometryMap => {
    const root = stage.current, result: GeometryMap = {}; if (!root) return result;
    const rect = root.getBoundingClientRect();
    for (const node of root.querySelectorAll<HTMLElement>('[data-el-id]')) {
      const box = node.getBoundingClientRect();
      result[node.dataset.elId!] = { x: (box.left - rect.left) / scale, y: (box.top - rect.top) / scale, w: box.width / scale, h: box.height / scale };
    }
    return result;
  }, [scale]);
  useImperativeHandle(forwardedRef, () => ({ geometry }), [geometry]);
  const resolved = gesture.current?.resolved || geometry();
  const selectedBox = slide && selected.length ? selectionBox(slide, selected, preview ? {} : resolved) : null;
  const selectedRoot = selected.length === 1 ? slide?.elements.find(element => element.id === selected[0]) : null;
  const rootId = (target: HTMLElement): string | null => {
    const hit = target.closest<HTMLElement>('[data-el-id]'); if (!hit) return null;
    let node = hit, parent = node.parentElement?.closest<HTMLElement>('[data-el-id]');
    while (parent) { node = parent; parent = parent.parentElement?.closest<HTMLElement>('[data-el-id]'); }
    return node.dataset.elId || null;
  };
  const begin = (event: React.PointerEvent, mode?: 'resize' | 'rotate', handle?: string) => {
    if ((event.target as HTMLElement).closest('[data-text-editor]')) return;
    if (event.button !== 0 && event.button !== 1) return;
    const start = point(event.clientX, event.clientY), id = rootId(event.target as HTMLElement), map = geometry();
    let ids = selected, kind: Gesture['mode'] = mode || 'move';
    if (hand || space || event.button === 1) kind = 'pan';
    else if (!mode && id) {
      if (event.shiftKey) ids = selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];
      else if (!selected.includes(id)) ids = [id];
      onSelect(ids);
      if (slide.elements.find(element => element.id === id)?.locked) return;
    } else if (!mode) {
      if (!event.shiftKey) { ids = []; onSelect([]); }
      if (start.x < 0 || start.x > document.canvas.width || start.y < 0 || start.y > document.canvas.height) return;
      kind = 'marquee'; setMarquee({ ...start, w: 0, h: 0 });
    }
    const box = slide ? selectionBox(slide, ids, map) : { x: 0, y: 0, w: 0, h: 0 };
    gesture.current = { mode: kind, ...start, clientX: event.clientX, clientY: event.clientY, ids, document, resolved: map, box, handle, scrollX: viewport.current?.scrollLeft || 0, scrollY: viewport.current?.scrollTop || 0 };
    lastPreview.current = null;
    if (mode || kind === 'pan') viewport.current?.setPointerCapture(event.pointerId);
    event.preventDefault(); event.stopPropagation();
  };
  const move = (event: React.PointerEvent) => {
    const activeGesture = gesture.current; if (!activeGesture || !slide) return;
    if (activeGesture.mode === 'pan') { if (viewport.current) { viewport.current.scrollLeft = activeGesture.scrollX - event.clientX + activeGesture.clientX; viewport.current.scrollTop = activeGesture.scrollY - event.clientY + activeGesture.clientY; } return; }
    const now = point(event.clientX, event.clientY), dx = now.x - activeGesture.x, dy = now.y - activeGesture.y;
    if (Math.hypot(event.clientX - activeGesture.clientX, event.clientY - activeGesture.clientY) < 3) return;
    if (viewport.current && !viewport.current.hasPointerCapture(event.pointerId)) viewport.current.setPointerCapture(event.pointerId);
    if (activeGesture.mode === 'marquee') { setMarquee({ x: Math.min(now.x, activeGesture.x), y: Math.min(now.y, activeGesture.y), w: Math.abs(dx), h: Math.abs(dy) }); return; }
    let next: PresentationSpec;
    if (activeGesture.mode === 'resize') {
      let { x, y, w, h } = activeGesture.box;
      if (activeGesture.handle?.includes('e')) w = Math.max(20, w + dx);
      if (activeGesture.handle?.includes('s')) h = Math.max(16, h + dy);
      if (activeGesture.handle?.includes('w')) { const change = Math.min(dx, w - 20); x += change; w -= change; }
      if (activeGesture.handle?.includes('n')) { const change = Math.min(dy, h - 16); y += change; h -= change; }
      if (event.shiftKey) h = w * activeGesture.box.h / Math.max(1, activeGesture.box.w);
      x = Math.max(0, x); y = Math.max(0, y); w = Math.min(w, document.canvas.width - x); h = Math.min(h, document.canvas.height - y);
      next = resizeSelection(activeGesture.document, slide.id, activeGesture.ids, { x, y, w, h }, activeGesture.resolved);
    } else if (activeGesture.mode === 'rotate') {
      const cx = activeGesture.box.x + activeGesture.box.w / 2, cy = activeGesture.box.y + activeGesture.box.h / 2;
      let degrees = (Math.atan2(now.y - cy, now.x - cx) - Math.atan2(activeGesture.y - cy, activeGesture.x - cx)) * 180 / Math.PI;
      if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
      next = rotateSelection(activeGesture.document, slide.id, activeGesture.ids, degrees, activeGesture.resolved);
    } else {
      const shiftX = event.shiftKey && Math.abs(dy) > Math.abs(dx) ? 0 : dx, shiftY = event.shiftKey && Math.abs(dx) >= Math.abs(dy) ? 0 : dy;
      const others = slide.elements.filter(element => !activeGesture.ids.includes(element.id) && !element.hidden).map(element => elementBox(element, activeGesture.resolved));
      const snap = event.altKey ? { x: activeGesture.box.x + shiftX, y: activeGesture.box.y + shiftY, guides: [] } : snapPosition({ ...activeGesture.box, x: activeGesture.box.x + shiftX, y: activeGesture.box.y + shiftY }, others, document.canvas, 6 / scale, grid);
      setGuides(snap.guides); next = moveSelection(activeGesture.document, slide.id, activeGesture.ids, snap.x - activeGesture.box.x, snap.y - activeGesture.box.y, activeGesture.resolved);
    }
    lastPreview.current = next; setPreview(next);
  };
  const finish = (event: React.PointerEvent) => {
    const activeGesture = gesture.current; if (!activeGesture) return;
    if (activeGesture.mode === 'marquee' && marquee) {
      const map = geometry();
      const ids = slide.elements.filter(element => !element.hidden && !element.locked).filter(element => { const box = elementBox(element, map); return box.x < marquee.x + marquee.w && box.x + box.w > marquee.x && box.y < marquee.y + marquee.h && box.y + box.h > marquee.y; }).map(element => element.id);
      onSelect(event.shiftKey ? [...new Set([...selected, ...ids])] : ids);
    } else if (lastPreview.current) onCommit(lastPreview.current, activeGesture.mode === 'rotate' ? 'Rotate selection' : activeGesture.mode === 'resize' ? 'Resize selection' : 'Move selection');
    gesture.current = null; lastPreview.current = null; setPreview(null); setGuides([]); setMarquee(null);
    if (viewport.current?.hasPointerCapture(event.pointerId)) viewport.current.releasePointerCapture(event.pointerId);
  };
  const edit = (event: React.MouseEvent) => {
    const id = rootId(event.target as HTMLElement), element = slide.elements.find(item => item.id === id);
    if (!element || element.locked || element.content.kind !== 'text') return;
    textCancelled.current = false; onSelect([element.id]); setEditing(element.id);
  };
  const editingElement = editing ? slide.elements.find(element => element.id === editing) : null;
  const editorBox = editingElement ? elementBox(editingElement, geometry()) : null;
  return <div ref={viewport} className={`v-canvas-viewport ${hand || space ? 'is-panning' : ''}`} onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onDoubleClick={edit} onContextMenu={event => { event.preventDefault(); const id = rootId(event.target as HTMLElement); if (id && !selected.includes(id)) onSelect([id]); onContextMenu({ x: event.clientX, y: event.clientY }); }}>
    <div className="v-canvas-world" style={{ width: Math.max(available.width, document.canvas.width * scale + 88), height: Math.max(available.height, document.canvas.height * scale + 70) }}>
      <div className="v-canvas-sized" style={{ width: document.canvas.width * scale, height: document.canvas.height * scale }}>
        <div ref={stage} className={`v-canvas-stage ${grid ? 'has-grid' : ''}`} data-testid="editor-canvas" style={{ width: document.canvas.width, height: document.canvas.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <SpecStage key={animate ? 'preview' : 'editor'} spec={active} index={index} animate={animate} />
          {grid && <div className="v-grid-overlay" style={{ backgroundSize: '8px 8px' }} />}
          {guides.map((guide, i) => <div key={i} className="v-smart-guide" style={guide.axis === 'x' ? { left: guide.value, top: 0, width: 1 / scale, height: document.canvas.height } : { left: 0, top: guide.value, width: document.canvas.width, height: 1 / scale }} />)}
          {selectedBox && selectedBox.w > 0 && !editing && <div className={`v-selection ${selectedRoot?.locked ? 'is-locked' : ''}`} style={{ left: selectedBox.x, top: selectedBox.y, width: selectedBox.w, height: selectedBox.h, borderWidth: 1.5 / scale, transform: selectedRoot?.rotation ? `rotate(${selectedRoot.rotation}deg)` : undefined }}>
            {!selectedRoot?.locked && <>
              {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => <button key={handle} type="button" aria-label={`Resize ${handle}`} data-testid={`resize-${handle}`} className={`v-resize v-resize-${handle}`} style={{ width: 9 / scale, height: 9 / scale, borderWidth: 1 / scale }} onPointerDown={event => begin(event, 'resize', handle)} />)}
              <button type="button" aria-label="Rotate selection" className="v-rotation" style={{ width: 20 / scale, height: 20 / scale, top: -38 / scale, left: `calc(50% - ${10 / scale}px)`, fontSize: 12 / scale }} onPointerDown={event => begin(event, 'rotate')}>↻</button>
            </>}
          </div>}
          {marquee && <div className="v-marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, borderWidth: 1 / scale }} />}
          {editingElement?.content.kind === 'text' && editorBox && <textarea data-text-editor autoFocus key={editingElement.id} className="v-inline-text" aria-label="Edit slide text" defaultValue={editingElement.content.text} style={{ left: editorBox.x, top: editorBox.y, width: editorBox.w, minHeight: editorBox.h, fontFamily: editingElement.style.fontFamily || document.theme.typography.headingFont, fontSize: editingElement.style.fontSize || 24, fontWeight: editingElement.style.fontWeight || 500, lineHeight: editingElement.style.lineHeight || 1.3, textAlign: editingElement.style.textAlign }} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { textCancelled.current = true; setEditing(null); } if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.blur(); } }} onBlur={event => { if (!textCancelled.current && event.target.value !== (editingElement.content.kind === 'text' ? editingElement.content.text : '')) onCommit(updateElement(document, slide.id, editingElement.id, { contentText: event.target.value }), 'Edit text'); setEditing(null); }} />}
        </div>
      </div>
    </div>
  </div>;
});
