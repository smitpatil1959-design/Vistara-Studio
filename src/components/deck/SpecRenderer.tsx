import { useMemo } from 'react';
import type { PresentationSpec } from '../../deck-spec';
import { specSlideToRenderable } from '../../deck-spec';
import { SlideCanvas } from './SlideRenderer';

/**
 * Spec-driven render adapter: the presentation.v1 document is the source of
 * truth; this component projects it into the layout engine. Manual and AI
 * edits land identically because both mutate the same schema.
 */
export function SpecSlide({
  spec,
  index,
  theme,
  animate = false,
}: {
  spec: PresentationSpec;
  index: number;
  theme?: Parameters<typeof SlideCanvas>[0]['theme'];
  animate?: boolean;
}) {
  const slide = useMemo(() => specSlideToRenderable(spec.slides[index], index), [spec, index]);
  return <SlideCanvas slide={slide} theme={theme} index={index} total={spec.slides.length} animate={animate} />;
}
