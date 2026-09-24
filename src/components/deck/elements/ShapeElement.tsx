import type { ShapeContent } from '../../../deck-spec';
import { useRenderCtx } from './context';

export function ShapeElement({ content, style, size }: { content: ShapeContent; style?: Record<string, unknown>; size?: { w: number | string; h: number | string } }) {
  const { theme } = useRenderCtx();
  const { colors, effects } = theme;
  const s = (style || {}) as { backgroundColor?: string; opacity?: number; radius?: number };
  const w = typeof size?.w === 'number' ? size.w : '100%';
  const h = typeof size?.h === 'number' ? size.h : 4;

  switch (content.shape) {
    case 'line':
    case 'divider':
      return (
        <div
          aria-hidden
          style={{
            width: w,
            height: 1.5,
            background: content.shape === 'divider' ? colors.line : `linear-gradient(90deg, transparent, ${s.backgroundColor || colors.accent}, ${colors.accent2}, transparent)`,
            opacity: s.opacity ?? 1,
          }}
        />
      );
    case 'glow':
      return (
        <div
          aria-hidden
          style={{
            width: typeof size?.w === 'number' ? size.w : 420,
            height: typeof size?.h === 'number' ? size.h : 300,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${s.backgroundColor || colors.accent}, transparent 72%)`,
            filter: 'blur(30px)',
            opacity: (effects.glowIntensity ?? 0.5) * (s.opacity ?? 1),
          }}
        />
      );
    case 'circle':
      return <div aria-hidden style={{ width: w, height: w, borderRadius: '50%', background: s.backgroundColor || colors.accent, opacity: s.opacity ?? 0.9 }} />;
    case 'pill':
      return <div aria-hidden style={{ width: w, height: typeof size?.h === 'number' ? size.h : 10, borderRadius: 999, background: s.backgroundColor || colors.surfaceAlt, border: `1px solid ${colors.line}` }} />;
    case 'rect':
    default:
      return <div aria-hidden style={{ width: w, height: h, borderRadius: s.radius ?? theme.radius.md, background: s.backgroundColor || colors.surfaceAlt, border: `1px solid ${colors.line}` }} />;
  }
}
