import type { TextContent } from '../../../deck-spec';
import { fontFamily, useRenderCtx } from './context';

/** Gradient-marked words in a title — `*word*` spans render in the theme gradient. */
function GradientSpans({ text, accent, accent2 }: { text: string; accent: string; accent2: string }) {
  const parts = String(text).split('*');
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={{ background: `linear-gradient(95deg, ${accent} 10%, ${accent2} 90%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export function TextElement({ content, style }: { content: TextContent; style?: Record<string, unknown> }) {
  const { theme } = useRenderCtx();
  const { colors, typography } = theme;
  const s = (style || {}) as import('../../../deck-spec').ElementStyle;

  const role = content.role || 'body';
  const base: Record<string, React.CSSProperties['fontSize']> = {};
  void base;
  const roleStyle: Record<string, React.CSSProperties> = {
    kicker: {
      fontFamily: fontFamily(typography.bodyFont),
      fontSize: s.fontSize ?? 11,
      letterSpacing: '0.3em',
      textTransform: 'uppercase',
      fontWeight: 600,
      color: colors.muted,
    },
    title: {
      fontFamily: fontFamily(typography.headingFont),
      fontSize: s.fontSize ?? Math.round(typography.baseSize * typography.scaleRatio ** 6),
      lineHeight: 1.06,
      fontWeight: typography.headingFont === 'Instrument Serif' ? 400 : 650,
      letterSpacing: '-0.025em',
      color: colors.text,
    },
    subtitle: {
      fontFamily: fontFamily(typography.bodyFont),
      fontSize: s.fontSize ?? Math.round(typography.baseSize * typography.scaleRatio ** 1.6),
      lineHeight: 1.5,
      color: colors.muted,
    },
    body: {
      fontFamily: fontFamily(typography.bodyFont),
      fontSize: s.fontSize ?? 17,
      lineHeight: 1.72,
      color: colors.muted,
    },
    caption: {
      fontFamily: fontFamily(typography.bodyFont),
      fontSize: s.fontSize ?? 11,
      letterSpacing: '0.06em',
      color: colors.muted,
      opacity: 0.75,
    },
    overline: {
      fontFamily: fontFamily(typography.bodyFont),
      fontSize: s.fontSize ?? 10,
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color: colors.accent,
    },
  };

  return (
    <div
      data-role={role}
      className="whitespace-pre-wrap"
      style={{
        ...roleStyle[role],
        ...(s.color ? { color: s.color } : {}),
        ...(s.textAlign ? { textAlign: s.textAlign } : {}),
        ...(s.fontFamily ? { fontFamily: fontFamily(s.fontFamily) } : {}),
        ...(s.fontWeight ? { fontWeight: s.fontWeight } : {}),
        ...(s.lineHeight ? { lineHeight: s.lineHeight } : {}),
        ...(s.letterSpacing !== undefined ? { letterSpacing: s.letterSpacing } : {}),
        ...(s.backgroundColor ? { background: s.backgroundColor, borderRadius: s.radius || 0 } : {}),
        overflowWrap: 'break-word',
      }}
    >
      <GradientSpans text={content.text ?? ''} accent={colors.accent} accent2={colors.accent2} />
    </div>
  );
}
