export function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[3/4] w-full rounded-lg bg-brand-gray-100" />
      <div className="mt-2 h-3.5 w-3/4 rounded bg-brand-gray-100" />
      <div className="mt-1.5 h-3.5 w-1/3 rounded bg-brand-gray-100" />
    </div>
  )
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
