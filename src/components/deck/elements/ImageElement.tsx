import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { ImageContent } from '../../../deck-spec';
import { useRenderCtx } from './context';

/** Images are untrusted URLs — http/https only. data: URLs for images only. */
function safeImageSrc(src: string): string {
  const s = String(src || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:image\//i.test(s)) return s;
  if (/^\/api\/asset-file\?/.test(s)) return s;
  return '';
}

export function ImageElement({ content, style, size }: { content: ImageContent; style?: Record<string, unknown>; size?: { w: number | string; h: number | string } }) {
  const { theme } = useRenderCtx();
  const [failed, setFailed] = useState(false);
  const { colors, radius, shadows } = theme;
  const s = (style || {}) as import('../../../deck-spec').ElementStyle;
  const shadow = s.shadow && s.shadow !== 'none' ? shadows[s.shadow] : undefined;
  const radiusPx = s.radius ?? radius.lg;
  const minH = typeof size?.h === 'number' ? Math.max(16, size.h) : 120;

  const src = safeImageSrc(content.src);
  if (failed || !src) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: '100%', height: '100%', minHeight: minH, borderRadius: radiusPx, background: colors.surfaceAlt, border: `1px dashed ${colors.line}`, color: colors.muted }}
      >
        <span className="flex flex-col items-center gap-1.5 text-[10px] font-mono">
          <ImageOff size={16} /> {content.alt || 'image unavailable'}
        </span>
      </div>
    );
  }

  const img = (
    <img
      src={src}
      alt={content.alt || ''}
      onError={() => setFailed(true)}
      className="w-full h-full"
      loading="lazy"
      style={{ objectFit: content.fit || 'cover', objectPosition: `${content.focalPoint?.x ?? 50}% ${content.focalPoint?.y ?? 50}%`, display: 'block', borderRadius: content.frame === 'browser' ? 0 : radiusPx }}
    />
  );

  if (content.frame === 'browser') {
    return (
      <div
        className="w-full h-full overflow-hidden"
        style={{ borderRadius: radiusPx, border: `1px solid ${colors.line}`, background: colors.surface, boxShadow: shadow || (s.shadow === 'none' ? undefined : shadows.md) }}
      >
        <div className="flex items-center gap-1.5" style={{ padding: '9px 13px', borderBottom: `1px solid ${colors.line}` }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
            <span key={c} className="rounded-full" style={{ width: 9, height: 9, background: c, opacity: 0.85 }} />
          ))}
          <span className="flex-1 text-center font-mono truncate" style={{ fontSize: 10.5, color: colors.muted }}>
            {src.replace(/^https?:\/\//, '').slice(0, 52)}
          </span>
        </div>
        <div style={{ height: 'calc(100% - 32px)' }}>{img}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden" style={{ borderRadius: radiusPx, boxShadow: shadow }}>
      {img}
    </div>
  );
}
