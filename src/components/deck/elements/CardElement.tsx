import { useMemo } from 'react';
import type { CardContent } from '../../../deck-spec';
import { fontFamily, useRenderCtx } from './context';
import { resolveIcon } from './icons';

export function CardElement({ content, style }: { content: CardContent; style?: Record<string, unknown> }) {
  const { theme } = useRenderCtx();
  const { colors, radius, shadows, typography, effects } = theme;
  const s = (style || {}) as { backgroundColor?: string; borderColor?: string; radius?: number; shadow?: string };
  const Icon = useMemo(() => (content.icon ? resolveIcon(content.icon) : null), [content.icon]);
  const sheetRadius = s.radius ?? radius.md;

  return (
    <div
      className="p-5 overflow-hidden flex flex-col justify-center"
      style={{
        background: s.backgroundColor || (effects.glass ? `${colors.surface}CC` : colors.surface),
        backdropFilter: effects.glass ? 'blur(12px)' : undefined,
        border: `1px solid ${s.borderColor || colors.line}`,
        borderRadius: sheetRadius,
        boxShadow: s.shadow && s.shadow !== 'none' ? shadows[(s.shadow as keyof typeof shadows) in shadows ? (s.shadow as keyof typeof shadows) : 'md'] : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: theme.radius.sm, background: `${colors.accent}1c`, border: `1px solid ${colors.accent}33` }}>
            {/* eslint-disable-next-line react-hooks/static-components -- icon registry lookup; identity stable per name */}
            <Icon size={15} style={{ color: colors.accent }} strokeWidth={1.9} />
          </span>
        )}
        {content.index != null && !Icon && (
          <span style={{ fontFamily: fontFamily(typography.headingFont), fontSize: 13, fontWeight: 600, color: colors.accent }}>{String(content.index + 1).padStart(2, '0')}</span>
        )}
        {content.metric && (
          <span
            style={{
              fontFamily: fontFamily(typography.headingFont),
              fontSize: 30,
              fontWeight: 650,
              letterSpacing: '-0.03em',
              background: `linear-gradient(120deg, ${colors.text} 30%, ${colors.accent})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {content.metric}
          </span>
        )}
      </div>
      <div
        className={`line-clamp-2 ${Icon || content.index != null || content.metric ? 'mt-2.5' : ''}`}
        style={{ fontFamily: fontFamily(typography.headingFont), fontSize: 16, fontWeight: 600, lineHeight: 1.3, color: colors.text }}
      >
        {content.title}
      </div>
      {content.body && (
        <p className="mt-1.5 line-clamp-3" style={{ fontFamily: fontFamily(typography.bodyFont), fontSize: 13, lineHeight: 1.55, color: colors.muted }}>
          {content.body}
        </p>
      )}
    </div>
  );
}
