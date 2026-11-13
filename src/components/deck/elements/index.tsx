import { motion } from 'framer-motion';
import type { SlideElement } from '../../../deck-spec';
import { useRenderCtx } from './context';
import { ElementBoundary, UnsupportedTile } from './ElementBoundary';
import { TextElement } from './TextElement';
import { ImageElement } from './ImageElement';
import { IconElement } from './IconElement';
import { ShapeElement } from './ShapeElement';
import { CardElement } from './CardElement';
import { ButtonElement } from './ButtonElement';
import { ChartElement, TableElement, DiagramElement } from './DataElements';
import { VideoElement } from './VideoElement';
import { GroupElement } from './GroupElement';

export function Element({ element, depth = 0, staggerBase = 0 }: { element: SlideElement; depth?: number; staggerBase?: number }) {
  const ctx = useRenderCtx();
  const { animate } = ctx;

  if (!element || !element.content || !element.type) {
    return <UnsupportedTile label="malformed element" />;
  }
  if (element.hidden) return null;

  // deterministic: explicit delay wins; otherwise order × stagger cadence
  const delayMs = (element.animation?.delayMs ?? 0) + staggerBase * ctx.motion.delayStaggerMs;
  const { variants, transition } = ctx.variantsFor(element.animation, delayMs);

  const style: React.CSSProperties =
    element.position.mode === 'absolute' && typeof element.position.x === 'number'
      ? {
          position: 'absolute',
          left: Math.max(0, Math.min(1280 - 24, element.position.x)),
          top: Math.max(0, Math.min(720 - 24, element.position.y ?? 0)),
          width: typeof element.size.w === 'number' ? element.size.w : 'auto',
          height: typeof element.size.h === 'number' ? element.size.h : 'auto',
        }
      : { position: 'relative' };
  style.opacity = element.style.opacity ?? 1;
  style.zIndex = element.zIndex;

  let body: React.ReactNode;
  switch (element.type) {
    case 'text':
      body = element.content.kind === 'text' ? <TextElement content={element.content} style={element.style} /> : <UnsupportedTile label="text: bad content" />;
      break;
    case 'image':
      body = element.content.kind === 'image' ? <ImageElement key={element.content.src} content={element.content} style={element.style} size={element.size} /> : <UnsupportedTile label="image: bad content" />;
      break;
    case 'icon':
      body = element.content.kind === 'icon' ? <IconElement content={element.content} style={element.style} /> : <UnsupportedTile label="icon: bad content" />;
      break;
    case 'shape':
      body = element.content.kind === 'shape' ? <ShapeElement content={element.content} style={element.style} size={element.size} /> : <UnsupportedTile label="shape: bad content" />;
      break;
    case 'card':
      body = element.content.kind === 'card' ? <CardElement content={element.content} style={element.style} /> : <UnsupportedTile label="card: bad content" />;
      break;
    case 'button':
      body = element.content.kind === 'button' ? <ButtonElement content={element.content} style={element.style} /> : <UnsupportedTile label="button: bad content" />;
      break;
    case 'chart':
      body = element.content.kind === 'chart' ? <ChartElement content={element.content} style={element.style} /> : <UnsupportedTile label="chart: bad content" />;
      break;
    case 'video':
      body = element.content.kind === 'video' ? <VideoElement content={element.content} style={element.style} /> : <UnsupportedTile label="video: bad content" />;
      break;
    case 'group':
      body = element.content.kind === 'group' ? <GroupElement content={element.content} depth={depth} /> : <UnsupportedTile label="group: bad content" />;
      break;
    case 'table':
      body = element.content.kind === 'table' ? <TableElement content={element.content} style={element.style} /> : null;
      break;
    case 'diagram':
      body = element.content.kind === 'diagram' ? <DiagramElement content={element.content} style={element.style} size={element.size} /> : null;
      break;
    default:
      body = <UnsupportedTile label={`unsupported: ${String(element.type)}`} />;
  }

  const dataAttrs = {
    'data-el-id': element.id,
    'data-el-type': element.type,
    'data-el-slot': element.position.slot || (element.position.mode === 'absolute' ? 'absolute' : 'body'),
    'data-locked': element.locked || undefined,
  };
  if (element.rotation) body = <div className="w-full h-full" style={{ transform: `rotate(${element.rotation}deg)`, transformOrigin: 'center' }}>{body}</div>;

  if (!animate) {
    return (
      <ElementBoundary fallbackLabel={`${element.type} ${element.id}`}>
        <div style={style} {...dataAttrs} className={element.position.mode === 'absolute' ? '' : 'relative min-w-0'}>
          {body}
        </div>
      </ElementBoundary>
    );
  }

  return (
    <ElementBoundary fallbackLabel={`${element.type} ${element.id}`}>
      <motion.div
        {...variants}
        transition={transition as never}
        style={{ ...style, willChange: animate ? 'opacity, transform' : undefined }}
        {...dataAttrs}
      >
        {body}
      </motion.div>
    </ElementBoundary>
  );
}
