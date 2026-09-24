import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Crop, ImageOff, ImagePlus, Loader2, Trash2, Check, UploadCloud } from 'lucide-react';
import { deleteAsset, listAssets, uploadAsset, type Asset } from '../services';
import ImageCropper from './ImageCropper';

/** Resilient image — shimmer while loading, graceful tile on failure. Keyed remount keeps state honest. */
function AssetImage({ src, alt }: { src: string; alt: string }) {
  const [phase, setPhase] = useState<'load' | 'ok' | 'err'>('load');
  if (phase === 'err' || !src) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-fog gap-1.5 bg-panel2">
        <ImageOff size={16} />
        <span className="text-[9px] font-mono">missing image</span>
      </div>
    );
  }
  return (
    <div className="w-full h-full relative">
      {phase === 'load' && <div className="absolute inset-0 shimmer-line" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`w-full h-full object-cover transition-opacity duration-300 ${phase === 'ok' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setPhase('ok')}
        onError={() => setPhase('err')}
      />
    </div>
  );
}

interface Props {
  projectId: string;
  onPick: (url: string, asset: Asset) => void;
  onClose: () => void;
  title?: string;
}

/** Project asset library — scan captures + uploads: pick, upload, crop, delete. */
export default function AssetLibrary({ projectId, onPick, onClose, title = 'Asset library' }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cropTarget, setCropTarget] = useState<Asset | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAssets(await listAssets(projectId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load assets');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listAssets(projectId);
        if (!cancelled) setAssets(rows);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load assets');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const onFile = async (f: File | null) => {
    if (!f) return;
    setUploading(true);
    setErr('');
    try {
      await uploadAsset(projectId, f);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      setTimeout(() => setConfirmId(null), 2400);
      return;
    }
    await deleteAsset(id);
    setConfirmId(null);
    await refresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="glass-deep bg-white rounded-3xl w-full max-w-3xl max-h-[84vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <span className="w-9 h-9 rounded-xl chip-lime flex items-center justify-center">
            <ImagePlus size={15} />
          </span>
          <div>
            <p className="font-display font-semibold text-[15px]">{title}</p>
            <p className="text-[11px] font-mono text-fog">{assets.length} assets · scan captures + uploads</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-grad rounded-xl px-4 py-2.5 text-[12.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
              Upload image
            </button>
            <button onClick={onClose} className="btn-quiet rounded-xl px-3.5 py-2.5 text-[12.5px]">
              Done
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {err && <p className="text-[12.5px] text-[#a2403a] bg-[#f9e3e0] border border-[#ecc5c0] rounded-xl px-4 py-3 mb-4">{err}</p>}
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-2xl overflow-hidden hairline">
                  <div className="aspect-[4/3] shimmer-line" />
                  <div className="p-3 flex items-center gap-2">
                    <div className="h-3 w-2/3 rounded shimmer-line" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-14">
              <div className="w-12 h-12 rounded-2xl bg-lime-soft hairline flex items-center justify-center text-lime-deep mx-auto mb-4">
                <ImageOff size={19} />
              </div>
              <h3 className="font-display font-semibold">No assets yet</h3>
              <p className="text-fog text-[13px] mt-1.5 max-w-sm mx-auto leading-relaxed">
                After a scan, website screenshots land here automatically. Upload brand imagery to use it on slides.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {assets.map((a) => (
                <div key={a.id} className="group rounded-2xl overflow-hidden hairline bg-white card-hover relative">
                  <button onClick={() => onPick(a.url, a)} className="block w-full text-left">
                    <div className="aspect-[4/3] bg-panel2 relative">
                      <AssetImage src={a.thumb_url || a.url} alt={a.name || 'asset'} />
                      <span className="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-[0.14em] rounded-full px-2 py-0.5 hairline bg-white/85 text-fog">
                        {a.kind === 'scan' ? `scan · ${a.source_page || '/'}` : 'upload'}
                      </span>
                      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-lime-deep/10 flex items-center justify-center">
                        <span className="chip-lime rounded-full px-3 py-1.5 text-[10.5px] font-semibold flex items-center gap-1.5">
                          <Check size={11} /> Use on slide
                        </span>
                      </span>
                    </div>
                    <div className="px-3 py-2.5 flex items-center gap-2">
                      <span className="text-[11.5px] truncate flex-1 font-medium">{a.name}</span>
                      <span className="text-[9.5px] font-mono text-fog/60 shrink-0">
                        {a.width && a.height ? `${a.width}×${a.height}` : ''} {a.bytes ? `· ${Math.round(a.bytes / 1024)}KB` : ''}
                      </span>
                    </div>
                  </button>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="Crop" onClick={() => setCropTarget(a)} className="p-1.5 rounded-md bg-white hairline text-fog hover:text-ink shadow-sm">
                      <Crop size={11} />
                    </button>
                    <button title={confirmId === a.id ? 'Confirm delete' : 'Delete'} onClick={() => void remove(a.id)} className={`p-1.5 rounded-md shadow-sm hairline ${confirmId === a.id ? 'bg-[#f9e3e0] text-[#a2403a]' : 'bg-white text-fog hover:text-[#a2403a]'}`}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {cropTarget && (
        <ImageCropper
          asset={cropTarget}
          onCancel={() => setCropTarget(null)}
          onDone={async (updated) => {
            onPick(updated.url, updated);
            setCropTarget(null);
            await refresh();
          }}
        />
      )}
    </motion.div>
  );
}
