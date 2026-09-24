import type { ChartContent } from '../../../deck-spec';
import { fontFamily, useRenderCtx } from './context';

export function ChartElement({ content, style }: { content: ChartContent; style?: Record<string, unknown> }) {
  const { theme } = useRenderCtx();
  const { colors, radius, typography } = theme;
  const s = (style || {}) as { backgroundColor?: string };

  // sanitize: drop non-finite/zero-ish points — malformed AI data must never break the render
  const series = (content.series || []).filter((p) => p && typeof p.value === 'number' && Number.isFinite(p.value)).slice(0, 12);
  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center text-[11px] font-mono" style={{ height: 140, borderRadius: radius.md, background: colors.surfaceAlt, border: `1px dashed ${colors.line}`, color: colors.muted }}>
        no chart data
      </div>
    );
  }
  const max = Math.max(1, ...series.map((p) => Math.abs(p.value)));

  return (
    <div
      className="p-5 flex flex-col"
      style={{ background: s.backgroundColor || colors.surface, border: `1px solid ${colors.line}`, borderRadius: radius.md }}
    >
      <div className="flex items-end gap-2.5" style={{ height: 120 }}>
        {series.map((p, i) => {
          const h = Math.max(6, Math.round((Math.abs(p.value) / max) * 100));
          const last = i === series.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <span className="text-[9px] font-mono" style={{ color: last ? colors.accent : colors.muted }}>
                {p.value}
              </span>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${h}%`,
                  background: last ? `linear-gradient(180deg, ${colors.accent}, ${colors.accent2})` : `${colors.text}1f`,
                  minHeight: 4,
                }}
              />
              <span className="text-[8.5px] font-mono truncate max-w-full" style={{ color: colors.muted }}>
                {String(p.label).slice(0, 9)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[9px] font-mono uppercase tracking-[0.18em]" style={{ color: colors.muted, fontFamily: fontFamily(typography.bodyFont) }}>
        {series.length} points · bars normalized to peak
      </div>
    </div>
  );
}
