import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Globe, LayoutGrid } from 'lucide-react';
import Ambient from '../components/layout/Ambient';
import TopNav from '../components/layout/TopNav';
import { hostOf } from '../lib/format';
import { listGallery, type GalleryItem } from '../services';
import { EmptyState, Pill } from '../components/ui';

/** Public showcase — decks whose owners chose to be listed. */
export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listGallery()
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen relative">
      <Ambient />
      <TopNav label="Public showcases" right={<Link to="/create" className="btn-grad rounded-xl px-4 py-2 text-[12.5px] font-semibold">Create yours</Link>} />

      <main className="max-w-6xl mx-auto px-6 py-14">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <span className="chip-lime rounded-full px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] inline-flex">The gallery</span>
          <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-[-0.03em] mt-4 leading-[1.02]">
            Websites, presented<br /> <span className="text-grad">by their makers.</span>
          </h1>
          <p className="text-fog mt-4 max-w-lg text-[15px] leading-relaxed">
            Every deck below was generated from a live website scan — the owner flipped it public. Anything here stays permanently in sync with its source study.
          </p>
        </motion.div>

        <div className="mt-12">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="glass rounded-2xl overflow-hidden bg-white">
                  <div className="aspect-[16/9] shimmer-line" />
                  <div className="p-4"><div className="h-4 w-2/3 rounded shimmer-line" /></div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="glass rounded-3xl bg-white">
              <EmptyState
                icon={<LayoutGrid size={20} />}
                title="Nothing public yet"
                sub="When owners mark a study Public from the workspace share card, it appears here — live and always in sync."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((p, i) => (
                <motion.article key={p.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Link to={`/p/${p.id}`} className="block glass rounded-2xl overflow-hidden bg-white card-hover">
                    <div className="aspect-[16/9] relative overflow-hidden bg-panel2 border-b border-line">
                      {p.screenshot ? (
                        <img src={p.screenshot} alt={p.name} className="w-full h-full object-cover object-top" loading="lazy" />
                      ) : (
                        <div className="w-full h-full grid-paper flex items-center justify-center text-fog font-display text-4xl">{p.name.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div className="absolute top-3 left-3 flex gap-1.5">
                        <Pill tone="success"><Globe size={10} /> Public</Pill>
                        {p.health != null && <Pill tone="accent">health {p.health}</Pill>}
                      </div>
                    </div>
                    <div className="p-5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display font-semibold truncate">{p.name}</h3>
                        <p className="text-fog text-xs font-mono mt-0.5 truncate">{hostOf(p.url)}</p>
                      </div>
                      <ArrowUpRight size={16} className="text-fog group-hover:text-lime-deep shrink-0" />
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
