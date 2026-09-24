import { createContext, useContext } from 'react';
import type { AnimationPreset, MotionSpec, SlideSpec, ThemeSpec } from '../../../deck-spec';
import type { EnterVariants } from '../motion';

/** Render context passed to every element — deterministic inputs only. */
export interface RenderCtx {
  theme: ThemeSpec;
  motion: MotionSpec;
  animate: boolean;
  interactive: boolean;
  /** accessibility: prefers-reduced-motion */
  reducedMotion: boolean;
  /** section 'manual' trigger: elements stay hidden until revealed */
  revealed: boolean;
  slide: SlideSpec | null;
  /** Variant factory hook supplied by the stage — keeps variants in one module */
  variantsFor: (anim: ElementAnimation | undefined, delayMs: number) => { variants: EnterVariants; transition: Record<string, unknown> };
}

export const RenderContext = createContext<RenderCtx | null>(null);
import type { ElementAnimation } from '../../../deck-spec';

export function useRenderCtx(): RenderCtx {
  const ctx = useContext(RenderContext);
  if (!ctx) throw new Error('deck elements must render inside <RenderContext.Provider>');
  return ctx;
}

export const fontFamily = (f: string) => (f && f.trim() ? `'${f}', sans-serif` : undefined);

/** Deterministic entrance variants — same spec in → same animation out. */
export function entranceFor(preset: AnimationPreset, isStatic: boolean) {
  if (isStatic || preset === 'none') return {};
  switch (preset) {
    case 'rise':
      return { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 } };
    case 'slide':
      return { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 } };
    case 'zoom':
      return { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 } };
    case 'stagger':
    case 'fade':
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 } };
  }
}
