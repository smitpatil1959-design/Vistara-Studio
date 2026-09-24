import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, RotateCcw, X } from 'lucide-react';
import type { Asset } from '../services';
import { cropAsset } from '../services';

interface Props {
  asset: Asset;
  onDone: (updated: Asset) => void;
  onCancel: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Drag-to-crop: commit writes a real server-side extract through sharp. */
export default function ImageCropper({ asset, onDone, onCancel }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
  const [err, setErr] = useState('');

  const measure = useCallback(() => {
    const el = boxRef.current;
    if (el) setBoxSize({ w: el.clientWidth, h: el.clientHeight });
  }, []);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const start = (e: React.PointerEvent) => {
    const el = boxRef.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(b.width, e.clientX - b.left));
    const y = Math.max(0, Math.min(b.height, e.clientY - b.top));
    setDragging({ x, y });
    setRect({ x, y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!dragging || !boxRef.current) return;
    const b = boxRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(b.width, e.clientX - b.left));
    const y = Math.max(0, Math.min(b.height, e.clientY - b.top));
    setRect({
      x: Math.min(dragging.x, x),
      y: Math.min(dragging.y, y),
      w: Math.abs(x - dragging.x),
      h: Math.abs(y - dragging.y),
    });
  };
  const up = () => setDragging(null);

  const apply = async () => {
    if (!rect || rect.w < 12 || rect.h < 12 || !asset.width || !asset.height) {
      setErr('Drag across the image to mark a crop region first.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const scaleX = asset.width / boxSize.w;
      const scaleY = asset.height / boxSize.h;
      const crop = {
        x: Math.round(rect.x * scaleX),
        y: Math.round(rect.y * scaleY),
        w: Math.round(rect.w * scaleX),
        h: Math.round(rect.h * scaleY),
      };
      const updated = await cropAsset(asset.id, crop);
      onDone(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Crop failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setRect(null);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/45 backdrop-blur-sm" onClick={onCancel}>
      <div className="glass-deep bg-white rounded-2xl p-5 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-display font-semibold text-[15px]">Crop — {asset.name}</p>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-fog hover:text-ink hover:bg-black/[0.04]">
            <X size={15} />
          </button>
        </div>

        <div
          ref={boxRef}
          className="relative w-full bg-[#17170f] rounded-xl overflow-hidden select-none touch-none"
          style={{ maxHeight: '52vh', aspectRatio: asset.width && asset.height ? `${asset.width} / ${asset.height}` : '16 / 10' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={up}
        >
          <img src={asset.url} alt={asset.name || 'crop target'} className="w-full h-full object-contain pointer-events-none" draggable={false} />
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="border border-white/15" />
            ))}
          </div>
          {rect && rect.w > 2 && (
            <div
              className="absolute border-2 border-lime bg-lime/15 pointer-events-none"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxShadow: '0 0 0 9999px rgba(23,23,15,0.45)' }}
            />
          )}
        </div>
        <p className="text-[11px] font-mono text-fog mt-2.5">
          drag to mark the region · everything outside will be trimmed
        </p>
        {err && <p className="text-[12px] text-[#a2403a] mt-2">{err}</p>}

        <div className="flex items-center gap-2 mt-4">
          <button onClick={reset} disabled={!rect || busy} className="btn-quiet rounded-xl px-4 py-2.5 text-[12.5px] flex items-center gap-1.5 disabled:opacity-40">
            <RotateCcw size={13} /> Reset
          </button>
          <span className="text-[11px] font-mono text-fog">
            {rect ? `${Math.round(rect.w)} × ${Math.round(rect.h)} px frame` : 'no region selected'}
          </span>
          <button onClick={apply} disabled={busy || !rect} className="btn-grad rounded-xl px-5 py-2.5 text-[12.5px] font-semibold flex items-center gap-1.5 ml-auto disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}
