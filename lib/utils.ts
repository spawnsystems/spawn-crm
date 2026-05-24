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
