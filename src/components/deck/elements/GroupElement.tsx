import type { GroupContent, SlideElement } from '../../../deck-spec';
import { useRenderCtx } from './context';
import { Element } from './index';

/** Groups render children flow-stacked; depth is capped so malformed nesting can't recurse forever. */
export function GroupElement({ content, depth = 0 }: { content: GroupContent; depth?: number }) {
  const { theme } = useRenderCtx();
  const children = Array.isArray(content.children) ? content.children.slice(0, 24) : [];
  if (depth > 6 || children.length === 0) return null;
  return (
    <div className="flex flex-col" style={{ gap: theme.spacing.unit * 2 }}>
      {children.map((child: SlideElement) => (
        <Element key={child.id} element={child} depth={depth + 1} />
      ))}
    </div>
  );
}
