import { useState } from 'react';
import { VideoOff } from 'lucide-react';
import type { VideoContent } from '../../../deck-spec';
import { useRenderCtx } from './context';

function safeVideoSrc(src: string): string {
  const s = String(src || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return '';
}

export function VideoElement({ content, style }: { content: VideoContent; style?: Record<string, unknown> }) {
  const { theme, interactive } = useRenderCtx();
  const [failed, setFailed] = useState(false);
  const { colors, radius } = theme;
  const s = (style || {}) as { radius?: number };
  const src = safeVideoSrc(content.src);

  if (failed || !src) {
    return (
      <div className="flex items-center justify-center" style={{ width: '100%', height: '100%', minHeight: 140, borderRadius: s.radius ?? radius.md, background: colors.surfaceAlt, border: `1px dashed ${colors.line}`, color: colors.muted }}>
        <span className="flex flex-col items-center gap-1.5 text-[10px] font-mono">
          <VideoOff size={16} /> video unavailable
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-hidden" style={{ borderRadius: s.radius ?? radius.md, border: `1px solid ${colors.line}`, background: '#000' }}>
      <video
        src={src}
        poster={content.poster && /^https?:\/\//i.test(content.poster) ? content.poster : undefined}
        muted={content.muted !== false}
        autoPlay={content.muted !== false}
        loop={content.muted !== false}
        playsInline
        controls={interactive}
        onError={() => setFailed(true)}
        className="w-full h-full"
        style={{ objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
