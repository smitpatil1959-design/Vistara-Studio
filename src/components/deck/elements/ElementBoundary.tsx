import { Component, type ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

/**
 * Malformed AI output must never crash a presentation. Any element that throws
 * during render is replaced with a subtle diagnostic tile.
 */
export class ElementBoundary extends Component<{ fallbackLabel?: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn('[deck] element render failed:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded" style={{ border: '1px dashed rgba(120,120,120,0.4)', color: 'rgba(120,120,120,0.9)' }}>
          <ShieldAlert size={10} /> {this.props.fallbackLabel || 'element skipped'}
        </span>
      );
    }
    return this.props.children;
  }
}

/** Unknown/unsupported element types degrade to this tile (never throws). */
export function UnsupportedTile({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded" style={{ border: '1px dashed rgba(120,120,120,0.4)', color: 'rgba(120,120,120,0.9)' }}>
      <ShieldAlert size={10} /> {label}
    </span>
  );
}
