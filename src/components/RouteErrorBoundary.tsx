import { Component, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, TriangleAlert } from 'lucide-react';

/** Root crash guard — a render fault in any route degrades to this, never a white screen. */
export default class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: unknown) {
    console.error('[route boundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-paper grid-paper flex items-center justify-center p-6">
          <div className="glass rounded-3xl bg-white p-10 max-w-md text-center noise relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(closest-side, rgba(217,242,107,0.45), transparent)', filter: 'blur(26px)' }} />
            <span className="w-12 h-12 rounded-2xl bg-[#f9e3e0] border border-[#ecc5c0] flex items-center justify-center text-[#a2403a] mx-auto mb-4">
              <TriangleAlert size={20} />
            </span>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Something rendered badly</h1>
            <p className="text-fog text-[13.5px] mt-2.5 leading-relaxed">
              The studio hit a rendering fault. Nothing was saved wrong — your work lives in the schema and persists.
            </p>
            <p className="text-[11px] font-mono text-fog/70 mt-3 break-words max-h-16 overflow-hidden">{this.state.error.message}</p>
            <div className="flex items-center justify-center gap-2 mt-7">
              <button
                onClick={() => this.setState({ error: null })}
                className="btn-quiet rounded-xl px-4 py-2.5 text-[12.5px] flex items-center gap-1.5"
              >
                <RefreshCw size={13} /> Try again
              </button>
              <Link to="/" className="btn-grad rounded-xl px-4 py-2.5 text-[12.5px] font-semibold" onClick={() => this.setState({ error: null })}>
                Back to Vistara
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
