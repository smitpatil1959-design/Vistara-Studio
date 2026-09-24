import { useEffect, useState } from 'react';
import { Braces, CheckCircle2, XCircle } from 'lucide-react';
import { getSpec, validateSpec } from '../services';
import type { PresentationSpec } from '../deck-spec';

/** Live view into the canonical presentation.v1 schema for the selected slide. */
export default function SpecInspector({ projectId, slideId, refreshKey }: { projectId: string; slideId: string; refreshKey: number }) {
  const [row, setRow] = useState<{ spec: PresentationSpec; version: number } | null>(null);
  const [err, setErr] = useState('');
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    let alive = true;
    getSpec(projectId)
      .then(async (r) => {
        if (!alive) return;
        const check = await validateSpec(r.spec).catch(() => ({ valid: false, errors: ['validator unreachable'] }));
        setRow({ spec: r.spec, version: r.version });
        setErr(check.valid ? '' : check.errors[0] || 'invalid');
      })
      .catch(() => setErr('no schema build yet'));
    return () => {
      alive = false;
    };
  }, [projectId, refreshKey]);

  const slide = row?.spec.slides.find((s) => s.id === slideId);

  return (
    <div className="rounded-xl hairline bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-line bg-panel2">
        <Braces size={13} className="text-lime-deep" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-fog">presentation.v1</span>
        {row && (
          <span className="ml-auto text-[10px] font-mono text-fog">
            v{row.version} · {row.spec.slides.length} slides
          </span>
        )}
        {row && (err ? <XCircle size={12} className="text-[#c4574e]" /> : <CheckCircle2 size={12} className="text-sage-deep" />)}
      </div>
      <div className="p-3.5">
        {!row && <p className="text-[11.5px] text-fog">Building schema…</p>}
        {row && slide && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-mono text-fog">
              {slide.elements.length} elements · transition={slide.transition} · layout={slide.layout}
            </p>
            {slide.elements.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-[11px] font-mono text-ink/70">
                <span className="chip-lime rounded px-1.5 py-0.5 text-[9px] font-semibold">{e.type}</span>
                <span className="text-fog">{e.position.slot ?? e.position.mode}</span>
                {e.content.kind === 'text' && <span className="truncate text-ink/50 flex-1">“{e.content.text.slice(0, 34)}”</span>}
                {e.content.kind === 'card' && <span className="truncate text-ink/50 flex-1">{e.content.title.slice(0, 34)}</span>}
              </div>
            ))}
            {slide.elements.length > 8 && <p className="text-[10px] font-mono text-fog/60">+{slide.elements.length - 8} more…</p>}
            <button onClick={() => setShowJson((v) => !v)} className="text-[10.5px] font-mono text-lime-deep hover:text-ink transition-colors text-left mt-1 underline underline-offset-2">
              {showJson ? 'hide raw JSON' : 'view raw JSON'}
            </button>
            {showJson && (
              <pre className="mt-2 max-h-[280px] overflow-auto text-[9.5px] font-mono leading-relaxed bg-[#17170f] text-[#d9f26b] rounded-xl p-3.5">
{JSON.stringify(slide, null, 2)}
              </pre>
            )}
          </div>
        )}
        {row && !slide && <p className="text-[11.5px] text-fog">This slide predates the schema rebuild — save any edit to sync it.</p>}
        {err && !row && <p className="text-[11.5px] text-fog">{err}</p>}
      </div>
    </div>
  );
}
