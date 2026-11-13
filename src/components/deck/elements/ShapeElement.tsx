import type { ElementStyle, ShapeContent } from '../../../deck-spec';
import { useRenderCtx } from './context';

export function ShapeElement({ content, style, size }: { content: ShapeContent; style?: Record<string, unknown>; size?: { w: number | string; h: number | string } }) {
  const { theme } = useRenderCtx();
  const { colors, effects } = theme;
  const s = (style || {}) as ElementStyle;
  const w = typeof size?.w === 'number' ? size.w : '100%';
  const h = typeof size?.h === 'number' ? size.h : 4;
  const border = `${s.borderWidth ?? 1}px solid ${s.borderColor || colors.line}`;
  const boxShadow = s.shadow && s.shadow !== 'none' ? theme.shadows[s.shadow] : undefined;

  switch (content.shape) {
    case 'line':
    case 'divider':
      return (
        <div
          aria-hidden
          style={{
            width: w,
            height: Math.max(1.5, s.borderWidth || 0),
            background: s.backgroundColor || (content.shape === 'divider' ? colors.line : colors.accent),
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
            opacity: effects.glowIntensity || 0.5,
          }}
        />
      );
    case 'circle':
      return <div aria-hidden style={{ width: w, height: h, borderRadius: '50%', background: s.backgroundColor || colors.accent, border, boxShadow }} />;
    case 'pill':
      return <div aria-hidden style={{ width: w, height: typeof size?.h === 'number' ? size.h : 10, borderRadius: 999, background: s.backgroundColor || colors.surfaceAlt, border, boxShadow }} />;
    case 'rect':
    default:
      return <div aria-hidden style={{ width: w, height: h, borderRadius: s.radius ?? theme.radius.md, background: s.backgroundColor || colors.surfaceAlt, border, boxShadow }} />;
  }
}
