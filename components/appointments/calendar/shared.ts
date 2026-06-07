// Helpers y tipos compartidos por las vistas de calendario (Mes / Semana / Día).

import { toBADate } from '@/lib/utils'
import type { AppointmentTipo } from '@/lib/schemas/appointments'
import type { getAppointmentsInRange } from '@/app/actions/appointments'

export type ApptRow = Awaited<ReturnType<typeof getAppointmentsInRange>>[number]

export type CalendarView = 'month' | 'week' | 'day'

// ── Grilla horaria ────────────────────────────────────────────────
// Rango de horas visible en las vistas Semana/Día.
export const HOUR_START  = 7     // 07:00
export const HOUR_END    = 22    // 22:00
export const HOUR_HEIGHT = 52    // px por hora

// ── Estilos por tipo de cita ──────────────────────────────────────
// Cierre es el más destacado (relleno sólido). El resto, suave.
interface TipoStyle {
  chip:    string   // chip compacto (vista Mes)
  block:   string   // bloque grande (Semana/Día)
  dot:     string   // puntito de color
  accent:  string   // borde izquierdo (cards lista)
  emphasis: boolean
}

export const TIPO_STYLE: Record<AppointmentTipo, TipoStyle> = {
  cierre: {
    chip:    'bg-emerald-600 text-white border-emerald-700',
    block:   'bg-emerald-600 text-white border-emerald-700 ring-1 ring-emerald-700/40',
    dot:     'bg-emerald-600',
    accent:  'border-l-emerald-600',
    emphasis: true,
  },
  visita_showroom: {
    chip:    'bg-violet-100 text-violet-800 border-violet-300',
    block:   'bg-violet-100 text-violet-900 border-violet-300',
    dot:     'bg-violet-500',
    accent:  'border-l-violet-400',
    emphasis: false,
  },
  videollamada: {
    chip:    'bg-sky-100 text-sky-800 border-sky-300',
    block:   'bg-sky-100 text-sky-900 border-sky-300',
    dot:     'bg-sky-500',
    accent:  'border-l-sky-400',
    emphasis: false,
  },
}

// ── Formato de horario ────────────────────────────────────────────

/** "14" o "14:30" en horario Buenos Aires. */
export function fmtHM(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`
}

/** Rango legible: "14-15hs", "14:30-15:30hs". */
export function formatApptRange(scheduledAt: string | Date, durationMin: number): string {
  const start = toBADate(scheduledAt)
  const end   = new Date(start.getTime() + durationMin * 60_000)
  return `${fmtHM(start)}-${fmtHM(end)}hs`
}

/** Minutos desde medianoche (BA) del inicio de la cita. */
export function apptStartMinutes(scheduledAt: string | Date): number {
  const d = toBADate(scheduledAt)
  return d.getHours() * 60 + d.getMinutes()
}

// ── ¿Es una cita "vencida"? (programada cuyo horario ya pasó) ──────
export function isApptPast(appt: ApptRow): boolean {
  return appt.status === 'programada' && new Date(appt.scheduled_at).getTime() < Date.now()
}

// ── Layout de solapamientos para grilla horaria ───────────────────
// Reparte en "carriles" las citas que se pisan en el tiempo, para
// mostrarlas lado a lado (interval partitioning).

export interface PositionedEvent {
  appt:     ApptRow
  startMin: number
  endMin:   number
  lane:     number   // columna asignada dentro del cluster
  lanes:    number   // total de columnas del cluster
}

export function layoutDayEvents(events: ApptRow[]): PositionedEvent[] {
  const items = events
    .map((appt) => {
      const startMin = apptStartMinutes(appt.scheduled_at)
      return { appt, startMin, endMin: startMin + Math.max(appt.duration_min, 30) }
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const result: PositionedEvent[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  function flush() {
    const laneEnds: number[] = []          // lane index → endMin de la última cita
    const placed: { item: (typeof items)[number]; lane: number }[] = []
    for (const item of cluster) {
      let lane = laneEnds.findIndex((end) => end <= item.startMin)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.endMin) }
      else laneEnds[lane] = item.endMin
      placed.push({ item, lane })
    }
    const lanes = laneEnds.length
    for (const p of placed) {
      result.push({
        appt:     p.item.appt,
        startMin: p.item.startMin,
        endMin:   p.item.endMin,
        lane:     p.lane,
        lanes,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const item of items) {
    if (cluster.length && item.startMin >= clusterEnd) flush()
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  if (cluster.length) flush()

  return result
}
