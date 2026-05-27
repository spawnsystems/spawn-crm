// Constantes derivadas del enum lead_status, centralizadas para
// reutilizar en sort, filtros y pipeline.

import { leadStatusValues } from '@/lib/schemas/leads'

export type LeadStatus = (typeof leadStatusValues)[number]

/**
 * Orden canónico del pipeline de ventas. Usado para sort en tablas
 * y para definir el orden de columnas en el Kanban.
 *
 *   Nuevo (0) → Contactado (1) → Citado (2) → Cerrado (3)
 *                                ↓
 *                          Para rescate (4)
 */
export const STATUS_ORDER: Record<LeadStatus, number> = {
  'Nuevo':        0,
  'Contactado':   1,
  'Citado':       2,
  'Cerrado':      3,
  'Para rescate': 4,
}

/** Estados terminales: el flujo no avanza más desde acá. */
export const TERMINAL_STATUSES: readonly LeadStatus[] = ['Cerrado'] as const

/** Estados activos del flujo de venta (excluye Cerrado y Para rescate). */
export const ACTIVE_STATUSES: readonly LeadStatus[] = ['Nuevo', 'Contactado', 'Citado'] as const

/** Estados del pipeline visibles como columnas del Kanban (en orden). */
export const PIPELINE_COLUMNS: readonly LeadStatus[] = [
  'Nuevo',
  'Contactado',
  'Citado',
  'Cerrado',
  'Para rescate',
] as const

/**
 * Texto amigable para un cambio de etapa, sin usar la palabra "estado".
 * Usado en el timeline del lead sheet.
 */
export function statusChangeLabel(from: string, to: string): string {
  if (to === 'Para rescate') return 'Enviado a rescate por inactividad'
  if (to === 'Cerrado')      return '¡Venta cerrada!'
  if (to === 'Citado')       return 'Cita agendada'
  if (to === 'Contactado')   return 'Marcado como contactado'
  if (to === 'Nuevo')        return 'Reiniciado a etapa inicial'
  return `Etapa actualizada: ${from} → ${to}`
}
