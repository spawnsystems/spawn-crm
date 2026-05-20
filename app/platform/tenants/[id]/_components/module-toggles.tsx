'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { MODULE_DEFINITIONS, type ModuleKey } from '@/lib/modules/definitions'
import { toggleModule } from '@/app/actions/platform'
import { toast } from 'sonner'

interface ModuleTogglesProps {
  tenantId:       string
  enabledModules: string[]
}

export function ModuleToggles({ tenantId, enabledModules }: ModuleTogglesProps) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(enabledModules))
  const [pending, setPending] = useState<string | null>(null)
  const [, startTransition]   = useTransition()

  function handleToggle(key: ModuleKey, comingSoon?: boolean) {
    if (pending || comingSoon) return

    const next = !enabled.has(key)
    setPending(key)

    // Actualización optimista inmediata
    setEnabled((prev) => {
      const s = new Set(prev)
      if (next) s.add(key)
      else s.delete(key)
      return s
    })

    startTransition(async () => {
      const res = await toggleModule(tenantId, key, next)
      setPending(null)
      if (!res.success) {
        toast.error('No se pudo actualizar el módulo')
        // Revertir
        setEnabled((prev) => {
          const s = new Set(prev)
          if (next) s.delete(key)
          else s.add(key)
          return s
        })
      }
    })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {MODULE_DEFINITIONS.map((mod) => {
        const isEnabled = enabled.has(mod.key)
        const isLoading = pending === mod.key

        return (
          <button
            key={mod.key}
            type="button"
            onClick={() => handleToggle(mod.key, mod.comingSoon)}
            disabled={!!pending || mod.comingSoon}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all',
              mod.comingSoon
                ? 'cursor-default opacity-60 border-border bg-muted/20'
                : isEnabled
                  ? 'border-primary/30 bg-primary/5 hover:bg-primary/8'
                  : 'border-border bg-card hover:bg-muted/50',
              pending && !isLoading && 'opacity-70',
            )}
          >
            {/* Indicador circular */}
            <div className={cn(
              'mt-0.5 size-4 rounded-full border-2 shrink-0 transition-colors',
              isLoading
                ? 'animate-pulse border-primary bg-primary/40'
                : isEnabled
                  ? 'bg-primary border-primary'
                  : 'border-muted-foreground/40 bg-transparent',
            )} />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className={cn(
                  'text-[13px] font-semibold leading-tight',
                  isEnabled ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {mod.nombre}
                </p>
                {mod.comingSoon && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                    Próximamente
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {mod.descripcion}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
