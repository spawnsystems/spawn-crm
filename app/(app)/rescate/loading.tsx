import { Skeleton } from '@/components/ui/skeleton'

export default function RescateLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-5 w-24" />
      </div>

      {/* Filter tabs */}
      <Skeleton className="h-9 w-full max-w-md rounded-lg" />

      {/* Lead cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
