export default function Ambient({ intensity = 1 }: { intensity?: number }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0 bg-paper" />
      <div className="absolute inset-0 grid-paper" />
      <div
        className="absolute -top-[22%] left-1/2 -translate-x-1/2 w-[90vw] h-[52vh]"
        style={{
          opacity: 0.75 * intensity,
          background: 'radial-gradient(closest-side, rgba(217,242,107,0.55), rgba(217,242,107,0.12) 55%, transparent 78%)',
          filter: 'blur(56px)',
        }}
      />
      <div
        className="absolute top-[46%] right-[-12%] w-[38vw] h-[38vh]"
        style={{ opacity: 0.4 * intensity, background: 'radial-gradient(closest-side, rgba(157,180,148,0.35), transparent)', filter: 'blur(60px)' }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(23,23,15,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,15,0.028) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />
      <div className="absolute inset-0 noise" style={{ position: 'absolute' }} />
    </div>
  );
}
