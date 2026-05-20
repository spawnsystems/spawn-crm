import { Skeleton } from '@/components/ui/skeleton'

export default function PlatformLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </main>
  )
}
