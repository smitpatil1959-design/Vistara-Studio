import { useState } from 'react';
import {
  ArrowDown, ArrowUp, BarChart3, Check, Copy, Image as ImageIcon, Layers3, MousePointer2,
  PaintBucket, Sparkles, Square, TextCursorInput, Trash2, Video, X,
} from 'lucide-react';
import type { PresentationSpec, SlideElement, SlideSpec } from '../deck-spec';
import { MOTION_PRESETS } from '../deck-spec';
import { HEADING_FONTS } from '../lib/themes';
import AssetLibrary from './AssetLibrary';

/* ------------------------------------------------ helpers */

const inputCls = 'input-ghost rounded-lg px-3 py-2 text-[12px] w-full';
const labelCls = 'text-[10px] font-mono uppercase tracking-[0.2em] text-fog mb-2 block';

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] text-fog w-16">{label}</span>
      <input type="color" value={/^#/.test(value) ? value.slice(0, 7) : '#000000'} onChange={(e) => onChange(e.target.value)} className="w-8 h-7 rounded-md bg-white hairline cursor-pointer" />
      <span className="text-[11px] font-mono text-fog flex-1 truncate">{value}</span>
    </label>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-fog">{label}</span>
        <span className="text-[10.5px] font-mono text-lime-deep">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#65a30d]"
        aria-label={label}
      />
    </div>
  );
}

const ADD_TOOLS: { type: SlideElement['type']; label: string; icon: React.ElementType }[] = [
  { type: 'text', label: 'Text', icon: TextCursorInput },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'icon', label: 'Icon', icon: Sparkles },
  { type: 'shape', label: 'Shape', icon: Square },
  { type: 'card', label: 'Card', icon: Layers3 },
  { type: 'button', label: 'Button', icon: MousePointer2 },
  { type: 'chart', label: 'Chart', icon: BarChart3 },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'shape', label: 'Glow', icon: PaintBucket },
];

/* ------------------------------------------------ panel */

interface Props {
  spec: PresentationSpec;
  slide: SlideSpec;
  slideIndex: number;
  selected: SlideElement | null;
  onCanvasCommit: (next: PresentationSpec, label?: string) => void;
  ops: typeof import('../deck-spec/ops');
  projectId: string;
  specStamp: number;
}

export default function InspectorPanel({ spec, slide, slideIndex, selected, onCanvasCommit, ops, projectId, specStamp }: Props) {
  const [tab, setTab] = useState<'element' | 'slide' | 'theme' | 'schema'>('element');
  const [libTarget, setLibTarget] = useState<null | 'element' | 'background'>(null);
  void specStamp;

  const closeLibrary = () => setLibTarget(null);
  const pickAsset = (url: string) => {
    if (libTarget === 'background') {
      onCanvasCommit(
        ops.updateSlide(spec, slide.id, { background: { ...slide.background, type: 'image', value: url } }),
        'Background image'
      );
    } else if (libTarget === 'element') {
      const selImg = slide.elements.find((e) => e.id === selected?.id && e.type === 'image');
      if (selImg) {
        onCanvasCommit(ops.updateElement(spec, slide.id, selImg.id, { imageSrc: url }), 'Replace image');
      }
    }
    closeLibrary();
  };
  const openLibrary = (t: 'element' | 'background') => setLibTarget(t);

  const commit = onCanvasCommit;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex border-b border-line shrink-0">
        {(
          [
            ['element', 'Element'],
            ['slide', 'Slide'],
            ['theme', 'Theme'],
            ['schema', 'Structure'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 py-3 text-[11.5px] font-medium transition-all border-b-2 ${tab === k ? 'text-ink border-lime-deep bg-lime-soft/50' : 'text-fog border-transparent hover:text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        {tab === 'element' && <ElementTab spec={spec} slide={slide} selected={selected} onCommit={commit} ops={ops} onTab={setTab} onOpenLibrary={openLibrary} />}
        {tab === 'slide' && <SlideTab spec={spec} slide={slide} slideIndex={slideIndex} onCommit={commit} ops={ops} onOpenLibrary={openLibrary} />}
        {tab === 'theme' && <ThemeTab spec={spec} onCommit={commit} ops={ops} />}
        {tab === 'schema' && <SchemaView slide={slide} />}
      </div>

      {libTarget && (
        <AssetLibrary
          projectId={projectId}
          title={libTarget === 'background' ? 'Slide background library' : 'Asset library'}
          onPick={(url) => pickAsset(url)}
          onClose={closeLibrary}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------ element tab */

function ElementTab({ spec, slide, selected, onCommit, ops, onTab, onOpenLibrary }: { spec: PresentationSpec; slide: SlideSpec; selected: SlideElement | null; onCommit: (n: PresentationSpec, l?: string) => void; ops: Props['ops']; onTab: (t: 'element' | 'slide' | 'theme' | 'schema') => void; onOpenLibrary: (t: 'element' | 'background') => void }) {
  if (!selected) {
    return (
      <div>
        <p className={labelCls}>Add to this slide</p>
        <div className="grid grid-cols-3 gap-1.5">
          {ADD_TOOLS.map((t, i) => (
            <button
              key={t.type + i}
              onClick={() => {
                const { spec: next } = ops.addElement(spec, slide.id, t.type);
                onCommit(next, `Add ${t.label}`);
                onTab('element');
              }}
              className="glass bg-white rounded-xl py-3 flex flex-col items-center gap-1.5 text-fog hover:text-ink hover:border-lime-deep/50 transition-all"
              title={`Add ${t.label}`}
            >
              <t.icon size={15} />
              <span className="text-[10px]">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-xl bg-panel2 hairline p-4 text-[12px] text-fog leading-relaxed">
          Select any element on the canvas to edit it. Click a selected element again to drag it; double-click text to rewrite it. Layers and colors live here once something is selected.
        </div>
        <LayersList spec={spec} slide={slide} selected={null} onCommit={onCommit} ops={ops} />
      </div>
    );
  }

  const st = selected.style || {};
  const commit = (next: PresentationSpec, label?: string) => onCommit(next, label);
  const content = selected.content;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span className="chip-lime rounded-full px-2.5 py-1 text-[9.5px] font-mono font-semibold uppercase tracking-[0.14em]">{selected.type}</span>
        <span className="text-[10px] font-mono text-fog/70 truncate">{selected.id.slice(0, 8)}…</span>
        <span className="ml-auto flex items-center gap-1">
          <button title="Layer back" onClick={() => commit(ops.reorderElement(spec, slide.id, selected.id, 'down'), 'Layer back')} className="p-1.5 rounded-md glass bg-white text-fog hover:text-ink"><ArrowDown size={11} /></button>
          <button title="Layer forward" onClick={() => commit(ops.reorderElement(spec, slide.id, selected.id, 'up'), 'Layer forward')} className="p-1.5 rounded-md glass bg-white text-fog hover:text-ink"><ArrowUp size={11} /></button>
          <button title="Duplicate (⌘D)" onClick={() => { const r = ops.duplicateElement(spec, slide.id, selected.id); commit(r.spec, 'Duplicate element'); }} className="p-1.5 rounded-md glass bg-white text-fog hover:text-ink"><Copy size={11} /></button>
          <button title="Delete (⌫)" onClick={() => commit(ops.deleteElement(spec, slide.id, selected.id), 'Delete element')} className="p-1.5 rounded-md glass bg-white text-fog hover:text-[#c4574e]"><Trash2 size={11} /></button>
        </span>
      </div>

      {/* content editing per type */}
      {content.kind === 'text' && (
        <div>
          <span className={labelCls}>Content</span>
          <textarea rows={3} className={`${inputCls} resize-none leading-relaxed`} value={content.text} onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { contentText: e.target.value }), 'Edit text')} />
          <div className="mt-3">
            <Slider label="Font size" value={st.fontSize ?? 17} min={9} max={88} onChange={(v) => commit(ops.updateElement(spec, slide.id, selected.id, { style: { fontSize: v } }), 'Font size')} format={(v) => `${v}px`} />
          </div>
          <div className="mt-3">
            <ColorField label="Color" value={st.color || spec.theme.colors.text} onChange={(v) => commit(ops.updateElement(spec, slide.id, selected.id, { style: { color: v } }), 'Text color')} />
          </div>
        </div>
      )}
      {content.kind === 'card' && (
        <div>
          <span className={labelCls}>Card content</span>
          <input className={`${inputCls} mb-2`} value={content.title} onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { cardTitle: e.target.value }), 'Card title')} placeholder="Title" />
          <textarea rows={2} className={`${inputCls} resize-none`} value={content.body} onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { cardBody: e.target.value }), 'Card body')} placeholder="Body" />
        </div>
      )}
      {content.kind === 'image' && (
        <div>
          <span className={labelCls}>Image</span>
          <div className="rounded-xl hairline bg-panel2 overflow-hidden mb-2">
            {content.src ? (
              <img src={content.src} alt={content.alt || 'slide image'} className="w-full h-32 object-cover object-top" />
            ) : (
              <div className="w-full h-32 flex items-center justify-center text-fog text-[11px] font-mono">no image set</div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button onClick={() => onOpenLibrary('element')} className="chip-lime rounded-lg px-3 py-2 text-[11.5px] font-semibold flex items-center gap-1.5 hover:brightness-95 transition-all">
              <ImageIcon size={12} /> Browse library
            </button>
            <button onClick={() => onOpenLibrary('element')} className="glass bg-white rounded-lg px-3 py-2 text-[11.5px] text-fog hover:text-ink transition-all">
              Upload new
            </button>
          </div>
          <input className={`${inputCls} mb-2`} placeholder="…or paste an image URL" value={content.src} onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { imageSrc: e.target.value }), 'Replace image')} />
          <input className={inputCls} placeholder="Alt text" value={content.alt} onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { imageAlt: e.target.value }), 'Alt text')} />
        </div>
      )}
      {content.kind === 'icon' && (
        <div>
          <span className={labelCls}>Lucide icon name</span>
          <input className={inputCls} value={content.name} onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { iconName: e.target.value }), 'Icon')} placeholder="sparkles" />
        </div>
      )}
      {content.kind === 'button' && (
        <div>
          <span className={labelCls}>Button</span>
          <input className={`${inputCls} mb-2`} value={content.label} onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { buttonLabel: e.target.value }), 'Button label')} />
          <input className={inputCls} value={content.href} placeholder="https://…" onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { buttonHref: e.target.value }), 'Button link')} />
        </div>
      )}
      {content.kind === 'shape' && (
        <div>
          <span className={labelCls}>Shape</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['line', 'divider', 'glow', 'circle', 'rect', 'pill'] as const).map((k) => (
              <button key={k} onClick={() => { const next = ops.cloneSpec(spec); const el = next.slides.find((s) => s.id === slide.id)!.elements.find((e) => e.id === selected.id)!; if (el.content.kind === 'shape') el.content.shape = k; commit(next, 'Shape'); }} className={`rounded-lg py-2 text-[11px] capitalize transition-all ${content.shape === k ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}>{k}</button>
            ))}
          </div>
        </div>
      )}

      {/* style */}
      <div>
        <span className={labelCls}>Style</span>
        <Slider label="Opacity" value={Math.round(((st.opacity ?? 1) as number) * 100)} min={5} max={100} onChange={(v) => commit(ops.updateElement(spec, slide.id, selected.id, { style: { opacity: v / 100 } }), 'Opacity')} format={(v) => `${v}%`} />
        {selected.type !== 'text' && selected.type !== 'icon' && (
          <div className="mt-3">
            <ColorField label="Fill / bg" value={(st.backgroundColor as string) || spec.theme.colors.surface} onChange={(v) => commit(ops.updateElement(spec, slide.id, selected.id, { style: { backgroundColor: v } }), 'Fill color')} />
          </div>
        )}
      </div>

      {/* animation */}
      <div>
        <span className={labelCls}>Entrance</span>
        <div className="grid grid-cols-5 gap-1.5">
          {(['fade', 'rise', 'slide', 'zoom', 'stagger'] as const).map((p) => (
            <button key={p} onClick={() => commit(ops.updateElement(spec, slide.id, selected.id, { animation: { preset: p } }), 'Animation')} className={`rounded-lg py-1.5 text-[10.5px] capitalize transition-all ${(selected.animation?.preset ?? 'fade') === p ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}>
              {p}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Slider label="Delay" value={selected.animation?.delayMs ?? 0} min={0} max={2000} step={50} onChange={(v) => commit(ops.updateElement(spec, slide.id, selected.id, { animation: { delayMs: v } }), 'Delay')} format={(v) => `${v}ms`} />
        </div>
      </div>

      {/* position & size */}
      <div>
        <span className={labelCls}>Position & size</span>
        <p className="text-[11px] text-fog/80 mb-2 leading-snug">{selected.position.mode === 'flow' ? 'Flow element — drag it on the canvas to pin it, then move/resize freely.' : 'Pinned to canvas coordinates.'}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(['x', 'y'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-fog">{k.toUpperCase()}</span>
              <input
                type="number"
                className={inputCls}
                value={Math.round((selected.position[k] ?? 0) as number)}
                onChange={(e) => commit(ops.updateElement(spec, slide.id, selected.id, { position: { mode: 'absolute', [k]: Number(e.target.value) } as never }), 'Move element')}
              />
            </label>
          ))}
          {(['w', 'h'] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-fog">{k.toUpperCase()}</span>
              <input
                type="number"
                className={inputCls}
                value={typeof selected.size[k] === 'number' ? Math.round(selected.size[k] as number) : 0}
                onChange={(e) => commit(ops.resizeElementTo(spec, slide.id, selected.id, k === 'w' ? Number(e.target.value) : Number(selected.size.w as number) || 200, k === 'h' ? Number(e.target.value) : Number(selected.size.h as number) || 120), 'Resize element')}
              />
            </label>
          ))}
        </div>
      </div>

      <LayersList spec={spec} slide={slide} selected={selected} onCommit={onCommit} ops={ops} />
    </div>
  );
}

function LayersList({ spec, slide, selected, onCommit, ops }: { spec: PresentationSpec; slide: SlideSpec; selected: SlideElement | null; onCommit: (n: PresentationSpec, l?: string) => void; ops: Props['ops'] }) {
  const els = slide.elements.slice(0, 24);
  if (!els.length) return null;
  return (
    <div>
      <span className={labelCls}>Layers · {slide.elements.length}</span>
      <div className="flex flex-col gap-1">
        {els.map((e) => (
          <button
            key={e.id}
            onClick={() => { /* parent passes onCommit only; selection happens on canvas click — request selection through layer click too */ }}
            className="hidden"
            aria-hidden
          />
        ))}
        {els.map((e, i) => (
          <div key={e.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] transition-all hairline ${selected?.id === e.id ? 'chip-lime' : 'bg-white text-fog hover:text-ink'}`}>
            <span className="text-[9px] font-mono uppercase w-12 shrink-0">{e.type}</span>
            <span className="flex-1 truncate">
              {e.content.kind === 'text' ? e.content.text.slice(0, 30) : e.content.kind === 'card' ? e.content.title : e.content.kind === 'image' ? (e.content.alt || 'image') : e.position.slot ?? e.id.slice(0, 8)}
            </span>
            <span className="flex gap-0.5 shrink-0">
              <button title="Move down" className="p-1 hover:text-ink" onClick={() => onCommit(ops.reorderElement(spec, slide.id, e.id, 'down'), 'Reorder layer')}><ArrowDown size={10} /></button>
              <button title="Move up" className="p-1 hover:text-ink" onClick={() => onCommit(ops.reorderElement(spec, slide.id, e.id, 'up'), 'Reorder layer')}><ArrowUp size={10} /></button>
            </span>
            <span className="text-[9px] font-mono text-fog/50 w-4 text-right">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------ slide tab */

const LAYOUTS = [['left', 'Left'], ['center', 'Centered'], ['split', 'Split'], ['grid', 'Grid']] as const;
const TRANSITIONS = ['fade', 'slide', 'zoom', 'stagger', 'morph', 'blur', 'none'] as const;
const TRIGGERS = [['onEnter', 'On enter'], ['onCascade', 'Cascade'], ['onHover', 'On hover'], ['manual', 'Manual reveal']] as const;
const DIRECTIONS = ['none', 'up', 'down', 'left', 'right'] as const;
const BG_TYPES = [['theme', 'Theme'], ['solid', 'Solid'], ['image', 'Image']] as const;

function SlideTab({ spec, slide, slideIndex, onCommit, ops, onOpenLibrary }: { spec: PresentationSpec; slide: SlideSpec; slideIndex: number; onCommit: (n: PresentationSpec, l?: string) => void; ops: Props['ops']; onOpenLibrary: (t: 'element' | 'background') => void }) {
  void spec;
  void slideIndex;
  const bg = slide.background;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className={labelCls}>Slide label</span>
        <input className={inputCls} value={slide.label} onChange={(e) => onCommit(ops.updateSlide(wrap(spec), slide.id, { label: e.target.value }), 'Slide label')} />
      </div>
      <div>
        <span className={labelCls}>Composition</span>
        <div className="grid grid-cols-4 gap-1.5">
          {LAYOUTS.map(([k, l]) => (
            <button key={k} onClick={() => onCommit(ops.updateSlide(wrap(spec), slide.id, { layout: k }), 'Layout')} className={`rounded-lg py-2 text-[11px] transition-all ${slide.layout === k ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className={labelCls}>Transition (entrance)</span>
        <div className="grid grid-cols-5 gap-1.5">
          {TRANSITIONS.map((t) => (
            <button key={t} onClick={() => onCommit(ops.updateSlide(wrap(spec), slide.id, { transition: t }), 'Transition')} className={`rounded-lg py-1.5 text-[10.5px] transition-all ${slide.transition === t ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className={labelCls}>Background</span>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {BG_TYPES.map(([k, l]) => (
            <button key={k} onClick={() => onCommit(ops.updateSlide(wrap(spec), slide.id, { background: { ...bg, type: k } }), 'Background')} className={`rounded-lg py-2 text-[11px] transition-all ${bg.type === k ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}>
              {l}
            </button>
          ))}
        </div>
        {bg.type === 'solid' && <ColorField label="Fill" value={bg.value || '#ffffff'} onChange={(v) => onCommit(ops.updateSlide(wrap(spec), slide.id, { background: { ...bg, value: v } }), 'Background color')} />}
        {bg.type === 'image' && (
          <div className="flex flex-col gap-2">
            <div className="rounded-xl hairline bg-panel2 overflow-hidden h-24">
              {bg.value ? <img src={bg.value} alt="background" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-fog text-[10.5px] font-mono">no image set</div>}
            </div>
            <button onClick={() => onOpenLibrary('background')} className="chip-lime rounded-lg px-3 py-2 text-[11.5px] font-semibold flex items-center gap-1.5 hover:brightness-95 transition-all self-start">
              <ImageIcon size={12} /> From library
            </button>
            <input className={inputCls} placeholder="…or paste an image URL" value={bg.value} onChange={(e) => onCommit(ops.updateSlide(wrap(spec), slide.id, { background: { ...bg, value: e.target.value } }), 'Background image')} />
          </div>
        )}
        <div className="mt-3">
          <label className="flex items-center gap-2 text-[11.5px] text-fog">
            <input type="color" value={(bg.overlay && /^#/.test(bg.overlay) ? bg.overlay : '#000000').slice(0, 7)} onChange={(e) => onCommit(ops.updateSlide(wrap(spec), slide.id, { background: { ...bg, overlay: `linear-gradient(160deg, transparent 30%, ${e.target.value}B3)` } }), 'Overlay')} className="w-8 h-7 rounded-md bg-white hairline cursor-pointer" />
            Gradient scrim color
            {bg.overlay && (
              <button className="ml-auto text-fog hover:text-[#c4574e]" onClick={() => onCommit(ops.updateSlide(wrap(spec), slide.id, { background: { type: bg.type, value: bg.value } }), 'Clear overlay')}>
                <X size={12} />
              </button>
            )}
          </label>
        </div>
      </div>
      <div className="rounded-xl bg-panel2 hairline p-4 text-[11.5px] text-fog leading-relaxed">
        Section: <span className="font-mono text-ink/70">{slide.section}</span> — section identity is preserved across syncs. Delete/reorder from the slide rail.
      </div>
    </div>
  );
}

const wrap = (spec: PresentationSpec) => spec;

/* ------------------------------------------------ theme tab */

function ThemeTab({ spec, onCommit, ops }: { spec: PresentationSpec; onCommit: (n: PresentationSpec, l?: string) => void; ops: Props['ops'] }) {
  const t = spec.theme;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className={labelCls}>Skin</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => onCommit(ops.patchTheme(spec, { skin: 'light', colors: { bg: '#F7F6F1', surface: '#FFFFFF', surfaceAlt: '#EFEEE6', text: '#17170F', muted: '#6E7264', line: 'rgba(23,23,15,0.10)' } }), 'Paper skin')} className={`rounded-lg py-2.5 text-[12px] transition-all ${t.skin === 'light' ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}>Paper</button>
          <button onClick={() => onCommit(ops.patchTheme(spec, { skin: 'dark', colors: { bg: '#08080F', surface: '#10101B', surfaceAlt: '#171724', text: '#F5F5FA', muted: '#9CA0B8', line: 'rgba(255,255,255,0.09)' } }), 'Ink skin')} className={`rounded-lg py-2.5 text-[12px] transition-all ${t.skin === 'dark' ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink'}`}>Ink</button>
        </div>
      </div>
      <div>
        <span className={labelCls}>Colors</span>
        <div className="flex flex-col gap-2.5">
          <ColorField label="Accent" value={t.colors.accent} onChange={(v) => onCommit(ops.patchTheme(spec, { colors: { accent: v } }), 'Accent')} />
          <ColorField label="Accent 2" value={t.colors.accent2} onChange={(v) => onCommit(ops.patchTheme(spec, { colors: { accent2: v } }), 'Accent 2')} />
          <ColorField label="Background" value={t.colors.bg} onChange={(v) => onCommit(ops.patchTheme(spec, { colors: { bg: v } }), 'Background')} />
          <ColorField label="Text" value={t.colors.text} onChange={(v) => onCommit(ops.patchTheme(spec, { colors: { text: v } }), 'Text color')} />
          <ColorField label="Muted" value={t.colors.muted} onChange={(v) => onCommit(ops.patchTheme(spec, { colors: { muted: v } }), 'Muted color')} />
          <ColorField label="Surface" value={t.colors.surface} onChange={(v) => onCommit(ops.patchTheme(spec, { colors: { surface: v } }), 'Surface')} />
        </div>
      </div>
      <div>
        <span className={labelCls}>Typography</span>
        <div className="flex flex-col gap-1.5">
          {HEADING_FONTS.map((f) => (
            <button key={f.id} onClick={() => onCommit(ops.patchTheme(spec, { typography: { headingFont: f.id } }), 'Heading font')} className={`rounded-lg px-3.5 py-2.5 text-left transition-all flex items-center justify-between ${t.typography.headingFont === f.id ? 'chip-lime' : 'glass bg-white hover:border-black/25'}`}>
              <span style={{ fontFamily: f.id }} className={`text-[13.5px] ${t.typography.headingFont === f.id ? 'text-lime-deep font-medium' : 'text-fog'}`}>{f.name}</span>
              <span className="text-[10px] font-mono text-fog/60">{f.vibe}</span>
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Slider label="Type scale" value={Math.round(t.typography.scaleRatio * 100)} min={112} max={150} onChange={(v) => onCommit(ops.patchTheme(spec, { typography: { scaleRatio: v / 100 } }), 'Type scale')} format={(v) => `×${(v / 100).toFixed(2)}`} />
        </div>
      </div>
      <div>
        <span className={labelCls}>Surface & motion</span>
        <Slider label="Corner radius" value={t.radius.md} min={0} max={40} onChange={(v) => onCommit(ops.patchTheme(spec, { radius: { md: v } }), 'Radius')} format={(v) => `${v}px`} />
        <div className="mt-3">
          <Slider label="Glow intensity" value={Math.round(t.effects.glowIntensity * 100)} min={0} max={100} onChange={(v) => onCommit(ops.patchTheme(spec, { effects: { glowIntensity: v / 100 } }), 'Glow')} format={(v) => `${v}%`} />
        </div>
        <label className="mt-3 flex items-center gap-2.5 text-[12.5px] text-fog cursor-pointer">
          <input type="checkbox" checked={t.effects.grain} onChange={(e) => onCommit(ops.patchTheme(spec, { effects: { grain: e.target.checked } }), 'Grain')} className="w-4 h-4 accent-[#65a30d]" />
          Film grain texture
        </label>
        <label className="mt-2.5 flex items-center gap-2.5 text-[12.5px] text-fog cursor-pointer">
          <input type="checkbox" checked={t.effects.glass} onChange={(e) => onCommit(ops.patchTheme(spec, { effects: { glass: e.target.checked } }), 'Glass')} className="w-4 h-4 accent-[#65a30d]" />
          Glass cards
        </label>
        <div className="mt-4">
          <Slider label="Motion duration" value={spec.motion.durationMs} min={200} max={1400} step={50} onChange={(v) => onCommit(ops.patchMotion(spec, { durationMs: v }), 'Motion speed')} format={(v) => `${v}ms`} />
        </div>
        <div className="mt-2.5">
          <Slider label="Stagger cadence" value={spec.motion.delayStaggerMs} min={0} max={300} step={10} onChange={(v) => onCommit(ops.patchMotion(spec, { delayStaggerMs: v }), 'Stagger')} format={(v) => `${v}ms`} />
        </div>
      </div>
      <div>
        <span className={labelCls}>Motion personality</span>
        <div className="grid grid-cols-2 gap-1.5">
          {MOTION_PRESETS.map((p) => {
            const on = spec.motion.preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onCommit(ops.setMotionPreset(spec, p.id), `Motion preset: ${p.label}`)}
                className={`rounded-xl p-3 text-left transition-all ${on ? 'chip-lime' : 'glass bg-white text-fog hover:text-ink hover:border-black/25'}`}
              >
                <span className={`block text-[12px] font-semibold ${on ? 'text-lime-deep' : 'text-ink'}`}>{p.label}</span>
                <span className="block text-[9.5px] mt-1 leading-snug">{p.vibe}</span>
                <span className="block text-[9px] font-mono mt-1.5 opacity-70">{p.durationMs}ms · {p.entrance}
                </span>
              </button>

            );
          })}
        </div>
        <p className="text-[10.5px] text-fog mt-2.5 leading-snug">
          {spec.motion.preset ? `Preset active — tune below to go hand-built, or ask the director for another ("futuristic", "elegant"…).` : 'Hand-tuned — pick a preset or shape it below.'}
        </p>
      </div>

      <div>
        <span className={labelCls}>Hand-tune</span>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ['entrance', spec.motion.entrance, ['fade', 'rise', 'slide', 'zoom', 'stagger', 'blur', 'scale', 'morph']],
            ['exit', spec.motion.exit, ['fade', 'rise', 'slide', 'zoom', 'stagger', 'blur', 'scale', 'morph']],
          ] as const).map(([key, val, opts]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-fog uppercase tracking-wider">{key}</span>
              <select value={val} onChange={(e) => onCommit(ops.tuneMotion(spec, { [key]: e.target.value } as never), 'Motion tuning')} className="input-ghost rounded-lg px-2.5 py-2 text-[11.5px] bg-white">
                {opts.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-fog uppercase tracking-wider">Direction</span>
            <select value={spec.motion.direction} onChange={(e) => onCommit(ops.tuneMotion(spec, { direction: e.target.value as never }), 'Direction')} className="input-ghost rounded-lg px-2.5 py-2 text-[11.5px] bg-white">
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-fog uppercase tracking-wider">Trigger</span>
            <select value={spec.motion.trigger} onChange={(e) => onCommit(ops.tuneMotion(spec, { trigger: e.target.value as never }), 'Trigger')} className="input-ghost rounded-lg px-2.5 py-2 text-[11.5px] bg-white">
              {TRIGGERS.map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ schema tab */

function SchemaView({ slide }: { slide: SlideSpec }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog mb-2">How this slide is assembled</p>
      <div className="flex items-center gap-2 text-[11px] font-mono text-fog mb-3">
        <Check size={12} className="text-sage-deep" />
        {slide.elements.length} pieces · auto-organized, undo-safe
      </div>
      <div className="flex flex-col gap-1.5 mb-3">
        {slide.elements.slice(0, 10).map((e) => (
          <div key={e.id} className="flex items-center gap-2 rounded-lg hairline bg-panel2 px-3 py-2">
            <span className="chip-lime rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase">{e.type}</span>
            <span className="text-[11.5px] text-ink/75 truncate flex-1">{e.content.kind === 'text' ? e.content.text.slice(0, 38) : e.content.kind === 'card' ? e.content.title : e.content.kind}</span>
          </div>
        ))}
        {slide.elements.length > 10 && <p className="text-[10px] font-mono text-fog/60 mt-1">+ {slide.elements.length - 10} more pieces…</p>}
      </div>
      <pre className="text-[9.5px] font-mono leading-relaxed bg-[#17170f] text-[#d9f26b] rounded-xl p-3.5 max-h-[420px] overflow-auto">
{JSON.stringify(slide, null, 2)}
      </pre>
      <p className="text-[10.5px] text-fog mt-3 leading-relaxed">
        No code. No raw files. Your edits, the AI's edits, and the presentation itself all live in one tidy structured document — the blueprint below, if you're curious.
      </p>
    </div>
  );
}


