import { Skeleton } from '@/components/ui/skeleton'

export default function TenantDetailLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="border-b bg-card px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </main>
  )
}
