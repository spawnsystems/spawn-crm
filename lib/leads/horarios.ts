// Horarios de preferencia del lead: rangos personalizables (puede haber varios).
// Se persisten en la columna `leads.horario_preferencia` (text) como JSON:
//   [{"from":"09:00","to":"12:00"},{"from":"17:00","to":"19:00"}]
// Para no romper datos viejos (que guardaban un solo "HH:MM"), el parser
// tolera el formato legacy y lo convierte a un rango abierto.

export interface HorarioRange {
  from: string   // "HH:MM"
  to:   string   // "HH:MM"
}

/** Serializa rangos a JSON para guardar en la DB. Devuelve null si está vacío. */
export function serializeHorarios(ranges: HorarioRange[]): string | null {
  const clean = ranges.filter((r) => r.from && r.to)
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
          .map((r) => ({ from: r.from, to: r.to }))
      }
    } catch {
      return []
    }
  }

  // Legacy: un solo "HH:MM" → rango con solo inicio
  return [{ from: trimmed, to: '' }]
}

/** Texto legible: "09:00–12:00 · 17:00–19:00". Vacío si no hay rangos. */
export function formatHorarios(raw: string | null | undefined): string {
  const ranges = parseHorarios(raw)
  if (ranges.length === 0) return ''
  return ranges
    .map((r) => (r.to ? `${r.from}–${r.to}` : r.from))
    .join(' · ')
}

/** Valida un rango: ambos campos presentes y from < to. */
export function isValidRange(r: HorarioRange): boolean {
  if (!r.from || !r.to) return false
  return r.from < r.to
}
