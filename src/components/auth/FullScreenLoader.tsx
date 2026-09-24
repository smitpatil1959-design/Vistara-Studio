import { motion } from 'framer-motion';
import Ambient from '../layout/Ambient';
import Logo from '../layout/Logo';

/** Full-viewport branded loader used while auth resolves. */
export default function FullScreenLoader({ label = 'Opening the studio…' }: { label?: string }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <Ambient intensity={0.5} />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-5">
        <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
          <Logo size={48} withWord={false} />
        </motion.div>
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-fog">{label}</p>
      </motion.div>
    </div>
  );
}
