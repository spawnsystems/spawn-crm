import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

/**
 * Tailwind class merger.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date / time ────────────────────────────────────────────────────

/**
 * Zona horaria del negocio. Todos los formatos de fechas visibles al usuario
 * se basan en este valor para que sean independientes del timezone del servidor
 * (UTC) y del navegador del usuario.
 */
export const BA_TZ = 'America/Argentina/Buenos_Aires'

/**
 * Convierte un timestamp UTC a un Date "falso-local" en horario de Buenos Aires.
 * Útil para pasarlo a date-fns/format y obtener horas locales correctas
 * sin necesidad de instalar date-fns-tz.
 *
 * Ejemplo: un UTC 2024-06-15T18:00:00Z → BA 15:00 → new Date(2024, 5, 15, 15, 0, 0)
 */
export function toBADate(date: Date | string | number): Date {
  const d = new Date(date)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value)
  // hour12:false puede devolver 24 para la medianoche — normalizar
  const h = get('hour') % 24
  return new Date(get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'))
}

/**
 * Convierte el valor de un <input type="datetime-local"> — que el usuario SIEMPRE
 * entiende como horario de Buenos Aires — al instante UTC correcto (ISO string),
 * sin depender del timezone del navegador. AR = UTC-3 fijo (sin horario de verano).
 *
 * "2026-06-18T18:00" (18 hs en BA) → "2026-06-18T21:00:00.000Z"
 *
 * Usar SIEMPRE para leer datetime-local antes de mandarlo al server, en vez de
 * `new Date(value)` (que interpreta el string en el TZ del navegador y se
 * desfasa si la PC del vendedor no está en horario argentino).
 */
export function baInputToISO(local: string): string {
  if (!local) return ''
  // Acepta "YYYY-MM-DDTHH:mm" o con segundos; le anexamos el offset fijo de AR.
  const withSeconds = local.length === 16 ? `${local}:00` : local
  return new Date(`${withSeconds}-03:00`).toISOString()
}

/**
 * Inverso de baInputToISO: convierte un instante a "YYYY-MM-DDTHH:mm" con la hora
 * de pared de Buenos Aires, para usarlo como value/default de un
 * <input type="datetime-local">. Independiente del timezone del navegador.
 */
export function dateToBAInput(date: Date | string | number): string {
  const d = toBADate(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Default para un <input type="datetime-local"> calculado como "hoy en BA + N días
 * a la hora HH:mm de Buenos Aires". Independiente del timezone del navegador, así
 * el valor sugerido siempre es una hora argentina real (no la del navegador).
 *
 *   baInputFromNow(1, 10) → mañana 10:00 BA → "2026-06-19T10:00"
 */
export function baInputFromNow(addDays: number, hour: number, minute = 0): string {
  const base = toBADate(new Date())          // componentes de pared BA (fake-local)
  base.setDate(base.getDate() + addDays)
  base.setHours(hour, minute, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`
}

/**
 * "15/06" — día y mes en horario Buenos Aires.
 */
export function fmtDayMonthAR(date: Date | string | number): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', timeZone: BA_TZ,
  }).format(new Date(date))
}

/**
 * "02 jun. 2025" — fecha corta legible en horario Buenos Aires.
 */
export function fmtDateShortAR(date: Date | string | number): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: BA_TZ,
  }).format(new Date(date))
}

/**
 * "yyyy-MM-dd" en horario Buenos Aires — para claves de agrupación por día.
 * Evita que un evento a las 22:00 BA (01:00 UTC del día siguiente) agrupe mal.
 */
export function fmtDateKeyAR(date: Date | string | number): string {
  // en-CA usa formato ISO (YYYY-MM-DD) de forma nativa
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: BA_TZ,
  }).format(new Date(date))
}

/**
 * Inicio del mes actual en horario Argentina, como instante UTC.
 * Para filtros server-side "del mes" que deben respetar el calendario AR
 * sin importar el timezone del servidor (Vercel/Supabase corren en UTC).
 * AR es UTC-3 fijo (sin horario de verano) → 00:00 AR = 03:00 UTC.
 */
export function startOfCurrentMonthAR(): Date {
  const { year, month } = currentYearMonthAR()
  return new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0))
}

/**
 * Inicio del día actual en horario Argentina, como instante UTC.
 * Para límites diarios (rate-limits) que respetan el calendario AR.
 * AR = UTC-3 fijo → 00:00 AR = 03:00 UTC.
 */
export function startOfTodayAR(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const year  = Number(parts.find((p) => p.type === 'year')!.value)
  const month = Number(parts.find((p) => p.type === 'month')!.value)
  const day   = Number(parts.find((p) => p.type === 'day')!.value)
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0))
}

/** Año y mes (1-12) actuales en horario Argentina, sin importar el TZ del server. */
export function currentYearMonthAR(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BA_TZ, year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  return {
    year:  Number(parts.find((p) => p.type === 'year')!.value),
    month: Number(parts.find((p) => p.type === 'month')!.value),
  }
}

/**
 * Formatea una fecha como tiempo relativo en español rioplatense.
 * Reemplaza las copias previas que vivían en leads-view.tsx y all-leads-view.tsx.
 *
 * Ejemplos:
 *   "Justo ahora", "Hace 12 min", "Hace 3h", "Ayer", "Hace 5 días"
 */
export function formatRelative(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'

  const diffMs  = Date.now() - d.getTime()
  if (diffMs < 0) return 'En el futuro'

  const diffMin = Math.floor(diffMs / 60_000)
  const diffH   = Math.floor(diffMin / 60)
  const diffD   = Math.floor(diffH / 24)

  if (diffMin < 2)  return 'Justo ahora'
  if (diffMin < 60) return `Hace ${diffMin} min`
  if (diffH < 24)   return `Hace ${diffH}h`
  if (diffD === 1)  return 'Ayer'
  return `Hace ${diffD} días`
}

// ── Number parsing ─────────────────────────────────────────────────

/**
 * Convierte un valor desconocido (string del DOM, columna numeric de Drizzle, etc.)
 * a number o undefined. Nunca devuelve NaN.
 *
 * Reemplaza patrones inseguros como `parseFloat(String(value))` que pueden
 * producir NaN silenciosamente.
 */
export function parseNumeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    // tolerar separadores de miles AR/US: "1.234.567,89" o "1,234,567.89"
    const cleaned = value.trim().replace(/\s+/g, '')
    if (!cleaned) return undefined
    // si hay coma como decimal y puntos como miles
    const hasComma = cleaned.includes(',')
    const hasDot   = cleaned.includes('.')
    let normalized = cleaned
    if (hasComma && hasDot) {
      // "1.234.567,89" → "1234567.89"
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else if (hasComma) {
      // "1234,89" → "1234.89"
      normalized = cleaned.replace(',', '.')
    }
    const n = parseFloat(normalized)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

// ── Currency ───────────────────────────────────────────────────────

/**
 * Formatea un monto en pesos argentinos.
 * - Si es >= 1M, abrevia: "$1,3M"
 * - Si es positivo: "$1.234.567"
 * - Si es 0/undefined/null/NaN: "—"
 */
export function formatCurrencyARS(value: unknown, opts: { compact?: boolean } = {}): string {
  const n = parseNumeric(value)
  if (n === undefined || n === 0) return '—'

  if (opts.compact && n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  }
  if (opts.compact && n >= 1_000) {
    return `$${Math.round(n / 1_000)}k`
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

// ── Strings ────────────────────────────────────────────────────────

/**
 * Toma un nombre y devuelve las iniciales en mayúscula (máx 2 letras).
 *   "Juan Perez"   → "JP"
 *   "  laura  "    → "L"
 *   ""             → "?"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return '?'
  if (parts.length === 1) return first.charAt(0).toUpperCase()
  const last = parts[parts.length - 1] ?? first
  return (first.charAt(0) + last.charAt(0)).toUpperCase()
}

// ── Safe async helpers ─────────────────────────────────────────────

/**
 * Envoltorio para refetch / promesas client-side que antes hacían
 * `getX().then(setState)` sin .catch. Ahora cualquier error muestra
 * un toast con un mensaje legible y se loguea en consola para debug.
 *
 * Uso:
 *   safeRefetch(() => getAllLeads(), 'No se pudieron actualizar los leads')
 *     .then(setLeads)
 */
export async function safeRefetch<T>(
  fn: () => Promise<T>,
  errorLabel = 'No se pudo actualizar la información',
): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    console.error('[safeRefetch]', errorLabel, err)
    toast.error(errorLabel)
    return null
  }
}
