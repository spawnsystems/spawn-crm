import { Skeleton } from '@/components/ui/skeleton'

export default function PipelineLoading() {
  return (
    <div className="p-6">
      <Skeleton className="h-7 w-32 mb-6" />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {Array.from({ length: 6 }).map((_, col) => (
          <div key={col} className="flex-shrink-0 w-64 space-y-2">
            <Skeleton className="h-8 rounded-lg" />
            {Array.from({ length: 3 - (col % 2) }).map((_, row) => (
              <Skeleton key={row} className="h-24 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
