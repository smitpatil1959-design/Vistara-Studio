export default function Logo({
  size = 34,
  withWord = true,
  className = '',
}: {
  size?: number;
  withWord?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span
        className="relative inline-flex items-center justify-center overflow-hidden rounded-[22%] bg-black shadow-sm ring-1 ring-black/10 shrink-0"
        style={{ width: size, height: size }}
      >
        <img
          src="/logo-square.png"
          alt="Vistara Studio logo"
          width={size}
          height={size}
          className="w-full h-full object-cover select-none pointer-events-none"
          loading="eager"
        />
      </span>
      {withWord && (
        <span className="font-display font-semibold tracking-[-0.02em] text-[17px] leading-none text-ink">
          Vistara<span className="text-lime-deep">&nbsp;Studio</span>
        </span>
      )}
    </span>
  );
}
