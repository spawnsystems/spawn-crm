// Horarios de preferencia del lead: rangos personalizables (puede haber varios).
// Se persisten en la columna `leads.horario_preferencia` (text) como JSON:
//   [{"from":"09:00","to":"12:00","days":[0,2]},{"from":"17:00","to":"19:00"}]
// `days` es opcional (0=Lun … 6=Dom); sin días = "cualquier día".
// Para no romper datos viejos (que guardaban un solo "HH:MM" o rangos sin days),
// el parser tolera el formato legacy.

export interface HorarioRange {
  from: string       // "HH:MM"
  to:   string       // "HH:MM"
  days?: number[]    // 0=Lun … 6=Dom. Vacío/ausente = cualquier día.
}

/** Etiquetas de día, lunes primero (índice 0..6). */
export const HORARIO_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const

function cleanDays(days: unknown): number[] {
  if (!Array.isArray(days)) return []
  return days.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
}

/** Serializa rangos a JSON para guardar en la DB. Devuelve null si está vacío. */
export function serializeHorarios(ranges: HorarioRange[]): string | null {
  const clean = ranges
    .filter((r) => r.from && r.to)
    .map((r) => {
      const days = cleanDays(r.days)
      return days.length ? { from: r.from, to: r.to, days } : { from: r.from, to: r.to }
    })
  return clean.length ? JSON.stringify(clean) : null
}

/** Parsea el valor crudo de la DB a rangos. Tolera JSON nuevo y formato viejo. */
export function parseHorarios(raw: string | null | undefined): HorarioRange[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (!trimmed) return []

  // Formato nuevo: JSON array
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) {
        return arr
          .filter((r) => r && typeof r.from === 'string' && typeof r.to === 'string')
          .map((r) => {
            const days = cleanDays(r.days)
            return days.length ? { from: r.from, to: r.to, days } : { from: r.from, to: r.to }
          })
      }
    } catch {
      return []
    }
  }

  // Legacy: un solo "HH:MM" → rango con solo inicio
  return [{ from: trimmed, to: '' }]
}

/** Etiqueta de días de un rango: "Lun, Mié" (vacío si aplica a cualquier día). */
export function formatDays(days: number[] | undefined): string {
  const clean = cleanDays(days)
  if (!clean.length) return ''
  return [...clean].sort((a, b) => a - b).map((d) => HORARIO_DAYS[d]).join(', ')
}

/** Texto legible: "Lun, Mié 09:00–12:00 · 17:00–19:00". Vacío si no hay rangos. */
export function formatHorarios(raw: string | null | undefined): string {
  const ranges = parseHorarios(raw)
  if (ranges.length === 0) return ''
  return ranges
    .map((r) => {
      const time = r.to ? `${r.from}–${r.to}` : r.from
      const days = formatDays(r.days)
      return days ? `${days} ${time}` : time
    })
    .join(' · ')
}

/** Valida un rango: ambos campos presentes y from < to. */
export function isValidRange(r: HorarioRange): boolean {
  if (!r.from || !r.to) return false
  return r.from < r.to
}
