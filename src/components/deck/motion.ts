/**
 * Presentation motion primitives — the ONLY place Framer variants are built.
 * Transform + opacity lead; blur is used sparingly and capped (GPU-friendly).
 * Reduced-motion collapses every distance and blur to zero automatically.
 */

import type { ElementAnimation, MotionDirection, MotionPresetId, MotionSpec } from '../../deck-spec';
import { getMotionPreset } from '../../deck-spec/motionPresets';

import type { TargetAndTransition } from 'framer-motion';

export interface EnterVariants {
  initial: TargetAndTransition & Record<string, unknown>;
  animate: TargetAndTransition & Record<string, unknown>;
  exit?: TargetAndTransition & Record<string, unknown>;
}

const DIR_VEC: Record<Exclude<MotionDirection, 'none'>, { x?: number; y?: number }> = {
  up: { y: 22 },
  down: { y: -22 },
  left: { x: -40 },
  right: { x: 40 },
};

/** Resolve the deck-level motion spec (preset applied first, overrides win). */
export function resolveDeckMotion(motion: MotionSpec): MotionSpec {
  if (motion.preset) {
    const base = getMotionPreset(motion.preset);
    return { ...base, ...Object.fromEntries(Object.entries(motion).filter(([, v]) => v !== undefined && v !== null)) as Partial<MotionSpec>, id: base.id, label: base.label, vibe: base.vibe, preset: motion.preset } as MotionSpec;
  }
  return motion;
}

/** Element-level entrance variants — deterministic from the spec. */
export function elementVariants(anim: ElementAnimation | undefined, motion: MotionSpec, reduced: boolean): EnterVariants {
  const m = resolveDeckMotion(motion);
  const reducedMotion = reduced;
  const preset = anim?.preset ?? m.entrance;
  const direction = anim?.direction ?? m.direction;
  const dist = DIR_VEC[direction !== 'none' ? direction : 'up'];

  if (reducedMotion || preset === 'none') {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0.12 } } };
  }

  switch (preset) {
    case 'fade':
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
    case 'rise':
      return { initial: { opacity: 0, ...dist }, animate: { opacity: 1, x: 0, y: 0 }, exit: { opacity: 0, y: -8 } };
    case 'slide':
      return {
        initial: { opacity: 0, x: (DIR_VEC.left.x ?? 0) * (direction === 'left' ? 1 : direction === 'right' ? -1 : 0) || -44 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: 16 },
      };
    case 'scale':
      return { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } };
    case 'blur':
      return { initial: { opacity: 0, scale: 0.985, filter: 'blur(10px)' }, animate: { opacity: 1, scale: 1, filter: 'blur(0px)' }, exit: { opacity: 0, filter: 'blur(4px)' } };
    case 'zoom':
      return { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.02 } };
    case 'morph':
      return { initial: { opacity: 0, scale: 0.96, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 1.015, y: -8 } };
    case 'stagger':
    default:
      return { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };
  }
}

export function elementTransition(anim: ElementAnimation | undefined, motion: MotionSpec, delayMs: number, reduced: boolean) {
  const m = resolveDeckMotion(motion);
  if (reduced) return { duration: 0.16, delay: 0 };
  return {
    duration: (anim?.durationMs ?? m.durationMs) / 1000,
    delay: (anim?.delayMs ?? 0) / 1000 + delayMs / 1000,
    ease: anim?.easing === 'spring-soft' || (motion.easing === 'spring-soft' && !anim?.easing) ? [0.22, 1, 0.36, 1] : anim?.easing === 'spring-snappy' || motion.easing === 'spring-snappy' ? [0.18, 1.2, 0.3, 1] : m.easing === 'ease-out' ? [0.16, 1, 0.3, 1] : undefined,
  } as const;
}

/** Slide-level transition variants for the presenter surface. */
export function slideTransition(motion: MotionSpec, transition: string, reduced: boolean) {
  const m = resolveDeckMotion(motion);
  if (reduced) return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, dur: 0.16, mode: 'wait' as const };
  const dur = m.durationMs / 1000;
  const mode = (m.transition === 'morph' || m.transition === 'blur' ? 'wait' : 'wait') as 'wait';
  switch (m.transition || transition) {
    case 'morph':
      // morph-like: outgoing scales up + dissolves while incoming materializes from 1.02→1
      return {
        initial: { opacity: 0, scale: 1.015, filter: 'blur(6px)' },
        animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, scale: 0.985, filter: 'blur(4px)' },
        dur: Math.max(dur * 0.9, 0.35),
        mode,
      };
    case 'blur':
      return { initial: { opacity: 0, filter: 'blur(10px)' }, animate: { opacity: 1, filter: 'blur(0px)' }, exit: { opacity: 0, filter: 'blur(6px)' }, dur, mode };
    case 'zoom':
      return { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.03 }, dur: Math.max(dur * 0.75, 0.22), mode };
    case 'slide':
      return { initial: { opacity: 0, x: 48 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -32 }, dur: Math.max(dur * 0.8, 0.24), mode };
    case 'stagger':
      return { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, dur, mode };
    case 'none':
      return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, dur: 0.01, mode };
    case 'fade':
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, dur, mode };
  }
}

/** A gentle, continuous parallax drift for media elements — transform-only, cheap. */
export function parallaxStyle(parallax: number, reduced: boolean, w: number): React.CSSProperties | undefined {
  if (reduced || !parallax || parallax <= 0) return undefined;
  const px = Math.round(8 * parallax);
  return {
    animation: `vistaraParallax ${Math.round(12000 / Math.max(0.2, parallax))}ms ease-in-out infinite alternate`,
    willChange: 'transform',
    ['--parallax-px' as string]: `${px * (w >= 768 ? 1 : 0.5)}px`,
  };
}

export function labelFor(id: MotionPresetId | null): string {
  return id ? getMotionPreset(id).label : 'Hand-tuned';
}
