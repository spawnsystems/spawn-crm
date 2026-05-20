import { Skeleton } from '@/components/ui/skeleton'

export default function ConfiguracionLoading() {
  return (
    <div className="p-8 max-w-[800px] mx-auto space-y-4">
      <div className="flex items-center gap-2.5 mb-6">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  )
}
