'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Target } from 'lucide-react'
import { upsertMetaMensual } from '@/app/actions/metas'
import { cn, getInitials } from '@/lib/utils'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface Vendedor {
  user_id: string
  nombre:  string | null
  alias:   string | null
}

interface MetaRow {
  user_id:     string
  mes:         number
  meta_ventas: number
}

interface MetasTabProps {
  vendedores:    Vendedor[]
  initialMetas:  MetaRow[]
  currentYear:   number
  currentMonth:  number
}

export function MetasTab({ vendedores, initialMetas, currentYear, currentMonth }: MetasTabProps) {
  const [anio,   setAnio]   = useState(currentYear)
  // Local grid state: Map<userId_mes, value>
  const [cells,  setCells]  = useState<Map<string, number>>(() => {
    const m = new Map<string, number>()
    for (const r of initialMetas) m.set(`${r.user_id}-${r.mes}`, r.meta_ventas)
    return m
  })
  const [, startTransition] = useTransition()
  const pendingRef = useRef<Set<string>>(new Set())

  function cellKey(userId: string, mes: number) { return `${userId}-${mes}` }

  function getValue(userId: string, mes: number): string {
    const v = cells.get(cellKey(userId, mes))
    return v != null && v > 0 ? String(v) : ''
  }

  function handleChange(userId: string, mes: number, raw: string) {
    const val = raw === '' ? 0 : Math.max(0, Math.min(9999, parseInt(raw, 10) || 0))
    const key = cellKey(userId, mes)
    setCells((prev) => {
      const next = new Map(prev)
      next.set(key, val)
      return next
    })
  }

  function handleBlur(userId: string, mes: number) {
    const key  = cellKey(userId, mes)
    const val  = cells.get(key) ?? 0
    if (pendingRef.current.has(key)) return
    pendingRef.current.add(key)

    startTransition(async () => {
      const res = await upsertMetaMensual({ user_id: userId, anio, mes, meta_ventas: val })
      pendingRef.current.delete(key)
      if (!res.success) {
        toast.error(`No se pudo guardar la meta: ${res.error}`)
      }
    })
  }

  const isCurrentYear  = anio === currentYear

  return (
    <div className="space-y-4">
      {/* Year nav */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setAnio((y) => y - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold w-14 text-center">{anio}</span>
        <Button
          size="sm" variant="outline" className="h-8 w-8 p-0"
          onClick={() => setAnio((y) => y + 1)}
          disabled={isCurrentYear}
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-1">
          Hacé click en una celda para editarla. Los cambios se guardan al salir del campo.
        </span>
      </div>

      {vendedores.length === 0 ? (
        <Card className="p-8 text-center">
          <Target className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No hay vendedores activos. Invitá miembros en la pestaña Miembros.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left border-b border-border">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground w-36 sticky left-0 bg-muted/40">
                  Vendedor
                </th>
                {MESES.map((m, idx) => (
                  <th
                    key={m}
                    className={cn(
                      'px-2 py-2.5 text-xs font-medium text-center',
                      isCurrentYear && idx + 1 === currentMonth
                        ? 'text-primary bg-primary/5'
                        : 'text-muted-foreground',
                    )}
                  >
                    {m}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => {
                const name  = v.alias || v.nombre || '?'
                const total = MESES.reduce((acc, _, idx) => acc + (cells.get(cellKey(v.user_id, idx + 1)) ?? 0), 0)

                return (
                  <tr key={v.user_id} className="border-b border-border/40 last:border-0 hover:bg-muted/10">
                    <td className="px-4 py-2 sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold shrink-0">
                          {getInitials(name)}
                        </div>
                        <span className="font-medium truncate max-w-[90px]" title={name}>{name}</span>
                      </div>
                    </td>
                    {MESES.map((_, idx) => {
                      const mes = idx + 1
                      const isCurrent = isCurrentYear && mes === currentMonth
                      return (
                        <td
                          key={mes}
                          className={cn(
                            'px-1 py-1.5 text-center',
                            isCurrent && 'bg-primary/5',
                          )}
                        >
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            value={getValue(v.user_id, mes)}
                            onChange={(e) => handleChange(v.user_id, mes, e.target.value)}
                            onBlur={() => handleBlur(v.user_id, mes)}
                            className={cn(
                              'w-14 h-7 text-center text-sm rounded border border-transparent px-1',
                              'hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30',
                              'bg-transparent transition-colors',
                            )}
                            placeholder="—"
                          />
                        </td>
                      )
                    })}
                    <td className="px-4 py-2 text-right font-semibold text-sm">
                      {total > 0 ? total : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
