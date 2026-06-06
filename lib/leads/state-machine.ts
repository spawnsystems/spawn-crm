// Máquina de estados del ciclo de vida del lead.
//
// Fuente de verdad de qué transiciones son legales. El embudo avanza SOLO
// por acciones reales (agendar llamada, crear cita, cita realizada, registrar
// venta); cada acción usa estas guardas para no permitir estados incoherentes.
//
//   GESTIÓN → HORARIO ASIGNADO → ENTREVISTA PACTADA → CIERRE → VENTA
//
// Reglas:
//   • Sin saltos: se avanza de a un peldaño (o por entradas paralelas válidas).
//   • Sin retroceso silencioso: solo no-show/cancelación revierten, y baja/rescate.
//   • Terminales bloqueados: VENTA y bajas no rescatables no se pueden cambiar.

import type { LeadStatus } from './constants'
import { BAJA_STATUSES, RESCATABLE_STATUSES } from './constants'

/** Orden del embudo activo. El índice define "más adelante" para no degradar. */
export const ACTIVE_FLOW = [
  'GESTION',
  'HORARIO ASIGNADO',
  'ENTREVISTA PACTADA',
  'CIERRE',
  'VENTA',
] as const

/** Índice del estado dentro del embudo activo, o -1 si es de baja. */
export function activeIndex(status: string): number {
  return (ACTIVE_FLOW as readonly string[]).indexOf(status)
}

/** True si el estado es terminal: VENTA (positivo) o cualquier baja (negativo). */
export function isTerminal(status: string): boolean {
  return status === 'VENTA' || (BAJA_STATUSES as readonly string[]).includes(status)
}

/** True si el lead está en una etapa activa donde todavía se puede operar. */
export function isOperable(status: string): boolean {
  return activeIndex(status) >= 0 && status !== 'VENTA'
}

/**
 * Avanza el estado hacia `target` sin nunca degradar. Si el lead ya está en una
 * etapa igual o posterior a `target`, devuelve el estado actual sin cambios.
 * Si alguno está fuera del embudo activo, no toca nada (devuelve `current`).
 *
 * Ej: advanceStatus('HORARIO ASIGNADO', 'ENTREVISTA PACTADA') → 'ENTREVISTA PACTADA'
 *     advanceStatus('CIERRE',           'ENTREVISTA PACTADA') → 'CIERRE' (no degrada)
 */
export function advanceStatus(current: string, target: LeadStatus): LeadStatus {
  const ci = activeIndex(current)
  const ti = activeIndex(target)
  if (ci < 0 || ti < 0) return current as LeadStatus
  return ti > ci ? target : (current as LeadStatus)
}

/** Razón por la que un lead terminal no admite una acción de avance (o null si OK). */
export function terminalBlockReason(status: string): string | null {
  if (status === 'VENTA') {
    return 'El lead ya está vendido — es un estado final y no admite cambios.'
  }
  if ((RESCATABLE_STATUSES as readonly string[]).includes(status)) {
    return 'El lead está dado de baja. Reactivalo desde Rescate antes de operarlo.'
  }
  if ((BAJA_STATUSES as readonly string[]).includes(status)) {
    return 'El lead está dado de baja de forma definitiva y no admite cambios.'
  }
  return null
}
