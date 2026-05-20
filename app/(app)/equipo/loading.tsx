import { Skeleton } from '@/components/ui/skeleton'

export default function EquipoLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-7 w-36" />

      {/* Podium */}
      <div className="flex items-end justify-center gap-4 h-48">
        <Skeleton className="w-28 h-32 rounded-xl" />
        <Skeleton className="w-28 h-44 rounded-xl" />
        <Skeleton className="w-28 h-24 rounded-xl" />
      </div>

      {/* Ranking list */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
