// Constantes derivadas del enum lead_status, centralizadas para
// reutilizar en sort, filtros, pipeline, badges y flujo de baja.

import { leadStatusValues, activeStatusValues, bajaStatusValues } from '@/lib/schemas/leads'

export type LeadStatus = (typeof leadStatusValues)[number]

/**
 * Orden canónico del flujo. Los activos avanzan 0→4; los de baja
 * van al final (90+) para que el sort por estado los agrupe abajo.
 *
 *   GESTIÓN (0) → HORARIO ASIGNADO (1) → ENTREVISTA PACTADA (2) → CIERRE (3) → VENTA (4)
 *   [baja: NO CONTESTA, NO INTERESADO, INCONTACTABLE, YA COMPRO, DATO ERRONEO, DERIVAR]
 */
export const STATUS_ORDER: Record<LeadStatus, number> = {
  'NUEVO':              -1,
  'GESTION':            0,
  'HORARIO ASIGNADO':   1,
  'ENTREVISTA PACTADA': 2,
  'CIERRE':             3,
  'VENTA':              4,
  'NO CONTESTA':        90,
  'NO INTERESADO':      91,
  'INCONTACTABLE':      92,
  'YA COMPRO':          93,
  'DATO ERRONEO':       94,
  'DERIVAR':            95,
}

/** Estados activos del flujo de venta (seleccionables para avanzar). */
export const ACTIVE_STATUSES: readonly LeadStatus[] = activeStatusValues

/** Estados de baja / terminales negativos (solo vía "Dar de baja"). */
export const BAJA_STATUSES: readonly LeadStatus[] = bajaStatusValues

/** Terminal positivo (venta concretada). */
export const POSITIVE_TERMINAL: readonly LeadStatus[] = ['VENTA'] as const

/** Estados terminales (no avanzan más): VENTA + todos los de baja. */
export const TERMINAL_STATUSES: readonly LeadStatus[] = ['VENTA', ...bajaStatusValues] as const

/**
 * Estados de baja que SÍ se pueden rescatar (vuelven al flujo).
 * 'YA COMPRO' (compró en otro lado) y 'DATO ERRONEO' (basura) no se rescatan.
 */
export const RESCATABLE_STATUSES: readonly LeadStatus[] = [
  'NO CONTESTA', 'NO INTERESADO', 'INCONTACTABLE', 'DERIVAR',
] as const

/** Estados del pipeline visibles como columnas del Kanban (en orden). */
export const PIPELINE_COLUMNS: readonly LeadStatus[] = [
  'NUEVO', 'GESTION', 'HORARIO ASIGNADO', 'ENTREVISTA PACTADA', 'CIERRE', 'VENTA',
] as const

/** Label de display (el enum guarda GESTION sin tilde por ser SQL-safe). */
export const STATUS_LABEL: Record<LeadStatus, string> = {
  'NUEVO':              'NUEVO',
  'GESTION':            'GESTIÓN',
  'HORARIO ASIGNADO':   'HORARIO ASIGNADO',
  'ENTREVISTA PACTADA': 'ENTREVISTA PACTADA',
  'CIERRE':             'CIERRE',
  'VENTA':              'VENTA',
  'NO CONTESTA':        'NO CONTESTA',
  'NO INTERESADO':      'NO INTERESADO',
  'INCONTACTABLE':      'INCONTACTABLE',
  'YA COMPRO':          'YA COMPRÓ',
  'DATO ERRONEO':       'DATO ERRÓNEO',
  'DERIVAR':            'DERIVAR',
}

/** Devuelve el label de display de un estado (fallback al valor crudo). */
export function statusLabel(status: string): string {
  return STATUS_LABEL[status as LeadStatus] ?? status
}

/**
 * Etiqueta visible del modelo de interés. Si el lead no tiene modelo definido
 * todavía, se muestra "Sin definir" (estado válido, no un modelo inventado).
 */
export function modeloLabel(modelo: string | null | undefined): string {
  return modelo?.trim() || 'Sin definir'
}

/**
 * Etiqueta visible del origen de un lead. Cuando el origen es "Otro" y tiene un
 * nombre personalizado cargado, se muestra ese nombre (no el genérico "Otro").
 */
export function sourceLabel(
  source: string | null | undefined,
  sourceCustom?: string | null,
): string {
  if (source === 'Otro' && sourceCustom?.trim()) return sourceCustom.trim()
  return source ?? '—'
}

/** True si el estado es de baja (terminal negativo). */
export function isBaja(status: string): boolean {
  return (BAJA_STATUSES as readonly string[]).includes(status)
}

/** True si el estado de baja se puede rescatar. */
export function isRescatable(status: string): boolean {
  return (RESCATABLE_STATUSES as readonly string[]).includes(status)
}

/**
 * Texto amigable para un cambio de etapa, sin usar la palabra "estado".
 * Usado en el timeline del lead sheet.
 */
export function statusChangeLabel(from: string, to: string): string {
  switch (to) {
    case 'NUEVO':              return 'Nuevo lead'
    case 'GESTION':            return 'En gestión'
    case 'HORARIO ASIGNADO':   return 'Horario de contacto asignado'
    case 'ENTREVISTA PACTADA': return 'Entrevista pactada'
    case 'CIERRE':             return 'En proceso de cierre'
    case 'VENTA':              return '¡Venta concretada!'
    default:                   return `Etapa actualizada: ${statusLabel(from)} → ${statusLabel(to)}`
  }
}
