'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h1 className="text-lg font-semibold">Algo salió mal</h1>

      {/* Mostrar mensaje en desarrollo, digest en producción */}
      <pre className="max-w-lg rounded-lg bg-muted px-4 py-3 text-left text-xs text-muted-foreground overflow-auto">
        {process.env.NODE_ENV === 'development'
          ? error.message
          : `digest: ${error.digest ?? 'sin digest'}`}
      </pre>

      <Button onClick={reset} variant="outline" size="sm">
        Reintentar
      </Button>
    </main>
  )
}
