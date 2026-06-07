'use client'

import { useMemo } from 'react'
import { isSameDay, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn, fmtDateKeyAR } from '@/lib/utils'
import {
  type ApptRow, HOUR_START, HOUR_END, HOUR_HEIGHT, layoutDayEvents,
} from './shared'
import { ApptBlock } from './appt-visuals'

const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const GRID_HEIGHT = (HOUR_END - HOUR_START) * HOUR_HEIGHT

// Posición vertical (px) de un minuto-desde-medianoche dentro de la grilla.
function topFor(minSinceMidnight: number): number {
  return ((minSinceMidnight - HOUR_START * 60) / 60) * HOUR_HEIGHT
}

export function TimeGrid({
  days, appts, onApptClick,
}: {
  days:        Date[]    // 1 (Día) o 7 (Semana)
  appts:       ApptRow[]
  onApptClick: (a: ApptRow) => void
}) {
  // Citas agrupadas por día (clave AR)
  const byDay = useMemo(() => {
    const map = new Map<string, ApptRow[]>()
    for (const a of appts) {
      const key = fmtDateKeyAR(a.scheduled_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return map
  }, [appts])

  const now      = new Date()
  const nowMin   = now.getHours() * 60 + now.getMinutes()
  const nowTop   = topFor(nowMin)
  const nowInRange = nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      {/* Encabezado de días */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `3rem repeat(${days.length}, 1fr)` }}>
        <div className="border-r border-border" />
        {days.map((d) => {
          const today = isSameDay(d, now)
          return (
            <div key={d.toISOString()} className="px-2 py-2 text-center border-r border-border last:border-r-0">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {format(d, 'EEE', { locale: es }).replace('.', '')}
              </div>
              <div className={cn(
                'inline-flex items-center justify-center mt-0.5 size-7 rounded-full text-sm font-semibold',
                today ? 'bg-primary text-primary-foreground' : 'text-foreground',
              )}>
                {format(d, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cuerpo con scroll */}
      <div className="max-h-[68vh] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: `3rem repeat(${days.length}, 1fr)` }}>
          {/* Eje de horas */}
          <div className="relative border-r border-border" style={{ height: GRID_HEIGHT }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums"
                style={{ top: (h - HOUR_START) * HOUR_HEIGHT }}
              >
                {h}:00
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          {days.map((day) => {
            const key       = fmtDateKeyAR(day)
            const dayAppts  = byDay.get(key) ?? []
            const positioned = layoutDayEvents(dayAppts)
            const today     = isSameDay(day, now)

            return (
              <div
                key={key}
                className="relative border-r border-border last:border-r-0"
                style={{ height: GRID_HEIGHT }}
              >
                {/* Líneas de hora */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/60"
                    style={{ top: (h - HOUR_START) * HOUR_HEIGHT }}
                  />
                ))}

                {/* Indicador de "ahora" */}
                {today && nowInRange && (
                  <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                    <div className="h-px bg-destructive" />
                    <div className="absolute -left-1 -top-1 size-2 rounded-full bg-destructive" />
                  </div>
                )}

                {/* Bloques de citas */}
                {positioned.map((p) => {
                  const top    = Math.max(topFor(p.startMin), 0)
                  const bottom = topFor(Math.min(p.endMin, HOUR_END * 60))
                  const height = Math.max(bottom - top, 20)
                  const widthPct = 100 / p.lanes
                  const compact  = height < 38
                  return (
                    <div
                      key={p.appt.id}
                      className="absolute z-10 px-px"
                      style={{
                        top,
                        height,
                        left:  `${p.lane * widthPct}%`,
                        width: `${widthPct}%`,
                      }}
                    >
                      <ApptBlock appt={p.appt} compact={compact} onClick={() => onApptClick(p.appt)} />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
