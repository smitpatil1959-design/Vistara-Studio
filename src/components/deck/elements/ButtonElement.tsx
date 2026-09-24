import { ArrowUpRight } from 'lucide-react';
import type { ButtonContent } from '../../../deck-spec';
import { fontFamily, useRenderCtx } from './context';

function safeHref(href: string): string {
  return /^(https?:)?\/\//.test(href || '') || href.startsWith('http') ? href : '#';
}

export function ButtonElement({ content, style }: { content: ButtonContent; style?: Record<string, unknown> }) {
  const { theme, interactive } = useRenderCtx();
  const { colors, radius, shadows, typography } = theme;
  const s = (style || {}) as { backgroundColor?: string; color?: string };
  const primary = content.variant !== 'ghost';

  const shared: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 26px',
    borderRadius: radius.pill,
    fontFamily: fontFamily(typography.headingFont),
    fontSize: 15,
    fontWeight: 600,
    textDecoration: 'none',
    cursor: interactive ? 'pointer' : 'default',
    pointerEvents: interactive ? 'auto' : 'none',
    background: primary ? `linear-gradient(100deg, ${colors.accent}, ${colors.accent2})` : 'transparent',
    color: primary ? (theme.skin === 'dark' ? '#0B0B12' : '#FFFFFF') : colors.text,
    border: primary ? 'none' : `1px solid ${colors.line}`,
    boxShadow: primary ? shadows.md : 'none',
  };

  return (
    <a href={safeHref(content.href)} target={interactive ? '_blank' : undefined} rel="noreferrer" style={{ ...shared, ...(s.backgroundColor ? { background: s.backgroundColor } : {}), ...(s.color ? { color: s.color } : {}) }}>
      {content.label || 'Learn more'}
      <ArrowUpRight size={14} />
    </a>
  );
}
