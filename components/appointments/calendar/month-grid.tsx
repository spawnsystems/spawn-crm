'use client'

import { useMemo } from 'react'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, format,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { cn, fmtDateKeyAR } from '@/lib/utils'
import { type ApptRow, apptStartMinutes } from './shared'
import { ApptChip } from './appt-visuals'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MAX_VISIBLE = 3

export function MonthGrid({
  anchor, appts, onApptClick, onMore, onDayClick,
}: {
  anchor:      Date
  appts:       ApptRow[]
  onApptClick: (a: ApptRow) => void
  onMore:      (date: Date) => void
  onDayClick:  (date: Date) => void
}) {
  // Rango de la grilla (incluye días de meses vecinos para completar semanas)
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
    const gridEnd   = endOfWeek(endOfMonth(anchor),     { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [anchor])

  // Citas por día (ordenadas por hora)
  const byDay = useMemo(() => {
    const map = new Map<string, ApptRow[]>()
    for (const a of appts) {
      const key = fmtDateKeyAR(a.scheduled_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    for (const list of map.values()) {
      list.sort((x, y) => apptStartMinutes(x.scheduled_at) - apptStartMinutes(y.scheduled_at))
    }
    return map
  }, [appts])

  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {/* Encabezado de días */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Semanas */}
      <div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {week.map((day) => {
              const key      = fmtDateKeyAR(day)
              const items    = byDay.get(key) ?? []
              const inMonth  = isSameMonth(day, anchor)
              const today    = isSameDay(day, new Date())
              const visible  = items.slice(0, MAX_VISIBLE)
              const hidden   = items.length - visible.length

              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-[104px] border-r border-border last:border-r-0 p-1 flex flex-col gap-0.5',
                    !inMonth && 'bg-muted/20',
                  )}
                >
                  {/* Número del día (clic → vista Día) */}
                  <div className="flex items-center justify-end px-0.5">
                    <button
                      onClick={() => onDayClick(day)}
                      title="Ver día"
                      className={cn(
                        'inline-flex items-center justify-center text-xs font-medium size-6 rounded-full hover:bg-muted transition-colors',
                        today && 'bg-primary text-primary-foreground hover:bg-primary',
                        !today && !inMonth && 'text-muted-foreground/50',
                        !today && inMonth && 'text-foreground',
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  </div>

                  {/* Chips de citas */}
                  <div className="flex flex-col gap-0.5">
                    {visible.map((a) => (
                      <ApptChip key={a.id} appt={a} onClick={() => onApptClick(a)} />
                    ))}
                    {hidden > 0 && (
                      <button
                        onClick={() => onMore(day)}
                        className="text-[11px] text-muted-foreground hover:text-foreground font-medium text-left px-1"
                      >
                        +{hidden} más
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
