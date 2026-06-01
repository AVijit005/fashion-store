export function ProductCardSkeleton() {
  return (
    <div className="group relative animate-pulse">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-fog/60">
        <div className="absolute left-3 top-3 flex flex-col gap-1">
          <div className="h-4 w-16 bg-line" />
        </div>
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <div className="h-9 w-9 bg-line" />
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-line" />
          <div className="h-3 w-1/2 bg-line" />
        </div>
        <div className="h-4 w-16 bg-line" />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-full bg-line" />
        <div className="h-3 w-3 rounded-full bg-line" />
        <div className="ml-2 h-3 w-16 bg-line" />
      </div>
    </div>
  );
}
