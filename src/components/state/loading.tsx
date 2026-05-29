export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-line border-t-ink" />
      </div>
      <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-mute">{label}</p>
    </div>
  );
}

export function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-fog ${className}`}
      style={{
        backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
        backgroundSize: "200% 100%",
        animation: "ink-shimmer 1.6s ease-in-out infinite",
      }}
    />
  );
}
