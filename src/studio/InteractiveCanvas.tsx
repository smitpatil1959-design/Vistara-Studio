import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PresentationSpec, SlideSpec } from '../deck-spec';
import { SpecStage } from '../components/deck/SpecStage';

export interface CanvasLiveState {
  slide: SlideSpec;
}

interface Props {
  spec: PresentationSpec;
  slideIndex: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onLiveEdit: (next: PresentationSpec) => void; // transient (no history)
  onCommitChange: (next: PresentationSpec, label?: string) => void; // history commit
  animate?: boolean;
}

/** Interactive spec canvas: hit-select, drag to move, corner resize, dblclick text edit. */
export default function InteractiveCanvas({ spec, slideIndex, selectedId, onSelect, onLiveEdit, onCommitChange, animate = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [selRect, setSelRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; startX: number; startY: number; stageX: number; stageY: number; mode: 'move' | 'resize'; startW: number; startH: number } | null>(null);
  const [editText, setEditText] = useState<{ id: string; rect: { x: number; y: number; w: number } } | null>(null);

  const slide = spec.slides[slideIndex];

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / spec.canvas.width));
    ro.observe(el);
    setScale(el.clientWidth / spec.canvas.width);
    return () => ro.disconnect();
  }, [spec.canvas.width]);

  const refreshSelRect = useCallback(() => {
    if (!selectedId || !wrapRef.current) return;
    const node = wrapRef.current.querySelector(`[data-el-id="${selectedId}"]`) as HTMLElement | null;
    const wrapBox = wrapRef.current.getBoundingClientRect();
    if (!node) return;
    const r = node.getBoundingClientRect();
    setSelRect({ left: r.left - wrapBox.left, top: r.top - wrapBox.top, width: r.width, height: r.height });
  }, [selectedId]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(refreshSelRect));
    return () => cancelAnimationFrame(raf);
  }, [selectedId, spec, slideIndex, scale, refreshSelRect]);

  const selectedEl = useMemo(() => {
    if (!slide || !selectedId) return null;
    const walk = (els: SlideSpec['elements']): SlideSpec['elements'][number] | null => {
      for (const e of els) {
        if (e.id === selectedId) return e;
        if (e.content.kind === 'group') {
          const hit = walk(e.content.children);
          if (hit) return hit;
        }
      }
      return null;
    };
    return walk(slide.elements);
  }, [slide, selectedId]);

  const stagePoint = (clientX: number, clientY: number) => {
    const st = stageRef.current?.getBoundingClientRect();
    if (!st) return { x: 0, y: 0 };
    return { x: (clientX - st.left) / scale, y: (clientY - st.top) / scale };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-selector-ui]')) return;
    const hit = (e.target as HTMLElement).closest('[data-el-id]') as HTMLElement | null;
    if (!hit) {
      onSelect(null);
      setEditText(null);
      return;
    }
    const id = hit.dataset.elId!;
    const isTarget = selectedId === id;
    if (!isTarget) {
      onSelect(id);
      return;
    }
    // begin drag — move or resize handled by overlay handles; body drag = move
    if (!selectedEl) return;
    live.current = true;
    const box = hit.getBoundingClientRect();
    const stage = stagePoint(box.left, box.top);
    setDrag({ id, startX: e.clientX, startY: e.clientY, stageX: stage.x, stageY: stage.y, mode: 'move', startW: box.width / scale, startH: box.height / scale });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const live = useRef(false);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !slide) return;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    const next = structuredClone(spec);
    const target = next.slides[slideIndex].elements.find((el) => el.id === drag.id)
      || next.slides[slideIndex].elements.flatMap((el) => (el.content.kind === 'group' ? el.content.children : [])).find((el) => el.id === drag.id);
    if (!target) return;
    if (drag.mode === 'move') {
      target.position = { ...target.position, mode: 'absolute', x: drag.stageX + dx, y: drag.stageY + dy };
      if (typeof target.size.w !== 'number') target.size.w = Math.round(drag.startW);
      if (typeof target.size.h !== 'number') target.size.h = Math.round(drag.startH);
    } else {
      target.size = { w: Math.max(48, Math.round(drag.startW + dx)), h: Math.max(24, Math.round(drag.startH + dy)) };
      // keep a px visual under the pointer immediately
      const node = wrapRef.current?.querySelector(`[data-el-id="${drag.id}"]`) as HTMLElement | null;
      if (node) {
        node.style.width = target.size.w + 'px';
        node.style.height = target.size.h + 'px';
      }
    }
    onLiveEdit(next);
  };

  const onPointerUp = () => {
    if (!drag || !slide) return;
    const committed = structuredClone(spec);
    const el = committed.slides[slideIndex].elements.find((x) => x.id === drag.id)
      || committed.slides[slideIndex].elements.flatMap((x) => (x.content.kind === 'group' ? x.content.children : [])).find((x) => x.id === drag.id);
    if (el) {
      if (drag.mode === 'move') {
        el.position = { ...el.position, mode: 'absolute', x: Math.round(el.position.x ?? drag.stageX), y: Math.round(el.position.y ?? drag.stageY) };
        if (typeof el.size.w !== 'number') el.size.w = Math.round(drag.startW);
        if (typeof el.size.h !== 'number') el.size.h = Math.round(drag.startH);
      }
      onCommitChange(committed, drag.mode === 'move' ? 'Move element' : 'Resize element');
    }
    setDrag(null);
    live.current = false;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const hit = (e.target as HTMLElement).closest('[data-el-id]') as HTMLElement | null;
    if (!hit) return;
    const id = hit.dataset.elId!;
    const el = slide?.elements.find((x) => x.id === id);
    if (!el || el.type !== 'text') return;
    const r = hit.getBoundingClientRect();
    const wrap = wrapRef.current!.getBoundingClientRect();
    setEditText({ id, rect: { x: r.left - wrap.left, y: r.top - wrap.top, w: Math.max(220, r.width) } });
    onSelect(id);
  };

  if (!slide) return null;

  return (
    <div ref={wrapRef} className="relative touch-none" style={{ width: '100%', aspectRatio: '16 / 9', userSelect: 'none' }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDoubleClick}>
      <div ref={stageRef} className="absolute inset-0 overflow-hidden rounded-[14px]">
        <SpecStage spec={spec} index={slideIndex} animate={animate} interactive={false} />
      </div>

      {/* selection overlay */}
      {selRect && selectedEl && <SelectionChrome rect={selRect} />}

      {/* resize handle */}
      {selRect && selectedEl && (
        <div
          data-selector-ui
          onPointerDown={(e) => {
            e.stopPropagation();
            live.current = true;
            setDrag({ id: selectedEl.id, startX: e.clientX, startY: e.clientY, stageX: 0, stageY: 0, mode: 'resize', startW: selRect.width / scale, startH: selRect.height / scale });
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          className="absolute w-3.5 h-3.5 rounded-sm bg-white border cursor-nwse-resize z-30"
          title="Drag to resize"
          style={{
            left: selRect.left + selRect.width - 7,
            top: selRect.top + selRect.height - 7,
            borderColor: spec.theme.colors.accent,
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          }}
        />
      )}

      {/* inline text editing */}
      {editText && selectedEl && selectedEl.content.kind === 'text' && (
        <textarea
          data-selector-ui
          autoFocus
          defaultValue={selectedEl.content.text}
          className="absolute z-40 bg-white rounded-lg text-[13px] p-2.5 outline-none"
          style={{ left: editText.rect.x, top: editText.rect.y, width: editText.rect.w, minHeight: 44, border: `2px solid ${spec.theme.colors.accent}`, fontFamily: 'inherit', color: '#17170f' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
            if (e.key === 'Escape') setEditText(null);
            e.stopPropagation();
          }}
          onBlur={(e) => {
            const v = e.target.value;
            const next = structuredClone(spec);
            const el = next.slides[slideIndex].elements.find((x) => x.id === editText.id);
            if (el && el.content.kind === 'text') {
              el.content.text = v;
              onCommitChange(next, 'Edit text');
            }
            setEditText(null);
          }}
        />
      )}
    </div>
  );
}

/** Selection outline + hints drawn in screen space over the scaled stage. */
function SelectionChrome({ rect }: { rect: { left: number; top: number; width: number; height: number } }) {
  return (
    <div
      data-selector-ui
      className="absolute pointer-events-none z-20"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        border: '1.5px solid #65a30d',
        borderRadius: 6,
        boxShadow: '0 0 0 3px rgba(217,242,107,0.35)',
      }}
    />
  );
}
