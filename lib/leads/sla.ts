// Cálculo de SLA / "Demorado" — derivado en la capa de app (sin triggers).
// El umbral es configurable por tenant (tenants.sla_config).

import { isBaja } from '@/lib/leads/constants'

export interface SlaConfig {
  /** Horas sin contacto antes de marcar un lead nuevo como "Sin contactar". */
  primerContactoHoras: number
  /** Días sin contacto antes de considerarlo inactivo (rescate). */
  sinContactoDias: number
  /** Horas que un lead activo puede estar sin próxima acción pactada antes de alertar. */
  sinProximaAccionHoras: number
  /** Días que un lead puede estar en CIERRE sin avances antes de alertar. */
  cierreEstancadoDias: number
  /** Horas de gracia tras la hora de una cita para marcarla "sin resolver". */
  citaVencidaGraciaHoras: number
}

export const DEFAULT_SLA: SlaConfig = {
  primerContactoHoras:    24,
  sinContactoDias:        15,
  sinProximaAccionHoras:  48,
  cierreEstancadoDias:    7,
  citaVencidaGraciaHoras: 2,
}

function num(o: Record<string, unknown>, key: keyof SlaConfig, fallback: number): number {
  const v = o[key]
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback
}

/** Normaliza el jsonb del tenant (puede venir null o parcial) a un SlaConfig. */
export function parseSlaConfig(raw: unknown): SlaConfig {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return {
      primerContactoHoras:    num(o, 'primerContactoHoras',    DEFAULT_SLA.primerContactoHoras),
      sinContactoDias:        num(o, 'sinContactoDias',        DEFAULT_SLA.sinContactoDias),
      sinProximaAccionHoras:  num(o, 'sinProximaAccionHoras',  DEFAULT_SLA.sinProximaAccionHoras),
      cierreEstancadoDias:    num(o, 'cierreEstancadoDias',    DEFAULT_SLA.cierreEstancadoDias),
      citaVencidaGraciaHoras: num(o, 'citaVencidaGraciaHoras', DEFAULT_SLA.citaVencidaGraciaHoras),
    }
  }
  return DEFAULT_SLA
}

interface SlaLeadInput {
  created_at:      Date | string
  last_contact_at: Date | string | null
  status:          string
}

export interface SlaResult {
  /** Lead activo que superó el umbral de contacto. */
  demorado: boolean
  /** Horas desde que ingresó el lead. */
  horasDesdeIngreso: number
  /** Horas desde el último contacto (null si nunca se contactó). */
  horasSinContacto: number | null
  /** True si nunca se registró un contacto. */
  sinPrimerContacto: boolean
}

const MS_HORA = 3_600_000

/**
 * Deriva el estado de SLA de un lead. "Demorado" solo aplica a leads activos
 * (no baja, no VENTA) cuyas horas sin contacto superan el umbral del tenant.
 */
export function computeSla(lead: SlaLeadInput, cfg: SlaConfig = DEFAULT_SLA): SlaResult {
  const now      = Date.now()
  const created  = new Date(lead.created_at).getTime()
  const contacto = lead.last_contact_at ? new Date(lead.last_contact_at).getTime() : null

  const horasDesdeIngreso = Math.max(0, (now - created) / MS_HORA)
  const horasSinContacto  = contacto !== null ? Math.max(0, (now - contacto) / MS_HORA) : null
  const sinPrimerContacto = contacto === null

  const esActivo = !isBaja(lead.status) && lead.status !== 'VENTA'

  // Referencia: horas sin contacto, o desde el ingreso si nunca se contactó.
  const horasReferencia = horasSinContacto ?? horasDesdeIngreso
  const demorado = esActivo && horasReferencia > cfg.primerContactoHoras

  return { demorado, horasDesdeIngreso, horasSinContacto, sinPrimerContacto }
}
