/**
 * lib/leads/attention.ts
 *
 * Motor de "atención" del lead: detecta leads activos que quedaron colgados o
 * con una acción vencida, para advertir al vendedor y dar visibilidad a sus
 * jefes. Es 100% derivado (sin cron ni triggers): se calcula al leer, igual
 * que el SLA.
 *
 * Un lead "requiere atención" cuando:
 *   - tiene una llamada agendada cuya hora ya pasó y no se registró,
 *   - tiene una cita que ya pasó y no se resolvió,
 *   - es nuevo y nadie lo contactó dentro del umbral,
 *   - está en CIERRE estancado sin avances, o
 *   - no tiene NINGUNA próxima acción pactada y está inactivo.
 */

import type { SlaConfig } from '@/lib/leads/sla'
import { isBaja } from '@/lib/leads/constants'

export type AttentionType =
  | 'llamada_vencida'
  | 'cita_sin_resolver'
  | 'sin_contactar'
  | 'cierre_estancado'
  | 'sin_proxima_accion'

export type AttentionSeverity = 'alta' | 'media'

export interface AttentionResult {
  needsAttention: boolean
  type:     AttentionType | null
  severity: AttentionSeverity | null
  /** Titular corto para el badge (ej: "Llamada vencida"). */
  reason:   string | null
  /** Detalle opcional (ej: "hace 3 h"). */
  detail:   string | null
}

/** Campos que el engine adjunta a cada lead devuelto por los queries. */
export interface AttentionFields {
  /** Backward-compat: true si requiere atención (antes era "Demorado"). */
  at_risk:            boolean
  attention_type:     AttentionType | null
  attention_severity: AttentionSeverity | null
  attention_reason:   string | null
  attention_detail:   string | null
  // ── Dos lentes independientes (un lead puede estar en una, ambas o ninguna) ──
  /** Alcance: lead activo del que TODAVÍA no se logró un contacto efectivo. */
  sin_contactar:      boolean
  /** Momentum: lead activo YA contactado pero sin próximo paso agendado ("colgado"). */
  colgado:            boolean
}

/** Labels legibles por tipo (para filtros, leyendas, paneles). */
export const ATTENTION_LABEL: Record<AttentionType, string> = {
  llamada_vencida:    'Llamada vencida',
  cita_sin_resolver:  'Cita sin resolver',
  sin_contactar:      'Sin contactar',
  cierre_estancado:   'Cierre estancado',
  sin_proxima_accion: 'Sin próxima acción',
}

/** Severidad canónica por tipo (para color/orden en paneles agregados). */
export const ATTENTION_SEVERITY: Record<AttentionType, AttentionSeverity> = {
  llamada_vencida:    'alta',
  cita_sin_resolver:  'alta',
  cierre_estancado:   'alta',
  sin_contactar:      'media',
  sin_proxima_accion: 'media',
}

/** Orden de prioridad para mostrar tipos en un panel (más grave primero). */
export const ATTENTION_ORDER: AttentionType[] = [
  'llamada_vencida', 'cita_sin_resolver', 'cierre_estancado',
  'sin_contactar', 'sin_proxima_accion',
]

const OK: AttentionResult = {
  needsAttention: false, type: null, severity: null, reason: null, detail: null,
}

const MS_HORA = 3_600_000

function toMs(v: Date | string | null | undefined): number | null {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? null : t
}

/** "hace 3 h" / "hace 2 d" a partir de milisegundos transcurridos. */
function ago(ms: number): string {
  const horas = ms / MS_HORA
  if (horas < 1)  return 'hace minutos'
  if (horas < 24) return `hace ${Math.floor(horas)} h`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export interface AttentionInput {
  status:           string
  created_at:       Date | string
  last_contact_at:  Date | string | null
  stage_entered_at: Date | string | null
  /** Hora de la llamada pendiente más próxima (sin registrar). Null si no hay. */
  pending_call_at:  Date | string | null
  /** Hora de la cita 'programada' del lead. Null si no hay. */
  open_appt_at:     Date | string | null
}

/**
 * Calcula el estado de atención de un lead. Las reglas se evalúan en orden de
 * prioridad: lo vencido (llamada/cita) primero; si hay un compromiso futuro el
 * lead está sano; si no, se evalúa según la etapa.
 */
export function computeAttention(
  lead: AttentionInput,
  cfg:  SlaConfig,
  now:  number = Date.now(),
): AttentionResult {
  // Terminales (venta o baja) nunca requieren atención.
  if (lead.status === 'VENTA' || isBaja(lead.status)) return OK

  const created   = toMs(lead.created_at) ?? now
  const contacto  = toMs(lead.last_contact_at)
  const etapa     = toMs(lead.stage_entered_at) ?? created
  const callAt    = toMs(lead.pending_call_at)
  const apptAt    = toMs(lead.open_appt_at)

  // 1) Llamada agendada cuya hora ya pasó y no se registró → ALTA.
  if (callAt !== null && callAt < now) {
    return {
      needsAttention: true, type: 'llamada_vencida', severity: 'alta',
      reason: 'Llamada vencida', detail: ago(now - callAt),
    }
  }

  // 2) Cita cuya hora pasó (+ gracia) y sigue 'programada' → ALTA.
  const graciaMs = cfg.citaVencidaGraciaHoras * MS_HORA
  if (apptAt !== null && now > apptAt + graciaMs) {
    return {
      needsAttention: true, type: 'cita_sin_resolver', severity: 'alta',
      reason: 'Cita sin resolver', detail: ago(now - apptAt),
    }
  }

  // ¿Hay un compromiso futuro pactado? (llamada o cita por venir)
  const tieneCompromisoFuturo =
    (callAt !== null && callAt >= now) || (apptAt !== null && apptAt >= now)

  // Con un próximo paso agendado, el lead está sano.
  if (tieneCompromisoFuturo) return OK

  // 3) Lead nuevo nunca contactado, pasado el umbral → media/alta por antigüedad.
  // Aplica al estado inicial NUEVO (y a GESTION legacy sin contacto).
  if ((lead.status === 'NUEVO' || lead.status === 'GESTION') && contacto === null) {
    const horas = (now - created) / MS_HORA
    if (horas > cfg.primerContactoHoras) {
      const severity: AttentionSeverity = horas > cfg.primerContactoHoras * 2 ? 'alta' : 'media'
      return {
        needsAttention: true, type: 'sin_contactar', severity,
        reason: 'Sin contactar', detail: ago(now - created),
      }
    }
  }

  // 4) CIERRE estancado sin avances ni próxima acción → ALTA.
  if (lead.status === 'CIERRE') {
    const horasEnEtapa = (now - etapa) / MS_HORA
    if (horasEnEtapa > cfg.cierreEstancadoDias * 24) {
      return {
        needsAttention: true, type: 'cierre_estancado', severity: 'alta',
        reason: 'Cierre estancado', detail: ago(now - etapa),
      }
    }
  }

  // 5) Activo sin ninguna próxima acción pactada, inactivo > umbral → MEDIA.
  // Referencia: el último indicio de actividad (contacto, entrada a etapa, ingreso).
  const ultimaActividad = Math.max(contacto ?? 0, etapa, created)
  const horasInactivo   = (now - ultimaActividad) / MS_HORA
  if (horasInactivo > cfg.sinProximaAccionHoras) {
    return {
      needsAttention: true, type: 'sin_proxima_accion', severity: 'media',
      reason: 'Sin próxima acción', detail: ago(now - ultimaActividad),
    }
  }

  return OK
}

/** Adjunta los campos de atención a un lead (incluye at_risk para compat). */
export function attachAttention<T extends AttentionInput>(
  lead: T,
  cfg:  SlaConfig,
  now?: number,
): T & AttentionFields {
  const a = computeAttention(lead, cfg, now)
  const n = now ?? Date.now()

  // Dos lentes independientes del "requiere atención" (que es el paraguas):
  const activo   = !(lead.status === 'VENTA' || isBaja(lead.status))
  const contacto = toMs(lead.last_contact_at)
  const callAt   = toMs(lead.pending_call_at)
  const apptAt   = toMs(lead.open_appt_at)
  const tieneFuturo =
    (callAt !== null && callAt >= n) || (apptAt !== null && apptAt >= n)

  return {
    ...lead,
    at_risk:            a.needsAttention,
    attention_type:     a.type,
    attention_severity: a.severity,
    attention_reason:   a.reason,
    attention_detail:   a.detail,
    // Alcance: activo y nunca contactado efectivamente.
    sin_contactar:      activo && contacto === null,
    // Momentum: activo, ya contactado, pero sin llamada/cita a futuro.
    colgado:            activo && contacto !== null && !tieneFuturo,
  }
}
