import { Skeleton } from '@/components/ui/skeleton'

export default function AllLeadsLoading() {
  return (
    <div className="p-6 space-y-4">
      {/* Header + search */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-60 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Table header */}
      <Skeleton className="h-10 rounded-lg" />

      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
