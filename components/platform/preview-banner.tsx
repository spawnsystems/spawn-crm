'use client'

import { useTransition } from 'react'
import { exitPreviewMode } from '@/app/actions/platform'
import { Eye, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PreviewBannerProps {
  tenantNombre: string
}

export function PreviewBanner({ tenantNombre }: PreviewBannerProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-500 px-4 py-2 text-amber-950">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Eye className="size-4 shrink-0" />
        <span>
          Modo Preview — <span className="font-bold">{tenantNombre}</span>
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 gap-1.5 rounded-lg px-2.5 text-xs text-amber-950 hover:bg-amber-600 hover:text-amber-950"
        disabled={isPending}
        onClick={() => startTransition(() => exitPreviewMode())}
      >
        {isPending
          ? <Loader2 className="size-3 animate-spin" />
          : <X className="size-3" />}
        Salir del preview
      </Button>
    </div>
  )
}
