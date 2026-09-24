import { useMemo } from 'react';
import type { IconContent } from '../../../deck-spec';
import { useRenderCtx } from './context';
import { resolveIcon } from './icons';

/** Icon renderer — glyph identity is memoized so spec names map 1:1 per render. */
export function IconElement({ content, style }: { content: IconContent; style?: Record<string, unknown> }) {
  const { theme } = useRenderCtx();
  const s = (style || {}) as { color?: string; fontSize?: number };
  const size = s.fontSize ?? 20;
  const IconGlyph = useMemo(() => resolveIcon(content.name), [content.name]);
  // eslint-disable-next-line react-hooks/static-components -- glyph identity is memoized and stable per name
  return <IconGlyph size={size} strokeWidth={1.8} style={{ color: s.color || theme.colors.accent }} />;
}
