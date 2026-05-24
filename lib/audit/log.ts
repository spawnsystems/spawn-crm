// ============================================================
// lib/audit/log.ts
//
// Helper de auditoría — fire-and-forget.
//
// Uso en server actions:
//   void logAudit({ tenantId, actorId: user.id, action: 'lead.create',
//                   entity: 'lead', entityId: row.id,
//                   meta: { nombre }, visibleToDueno: true })
//
// El void evita que un fallo de auditoría bloquee la respuesta al cliente.
// Los errores se loguean en consola para debugging pero no se propagan.
// ============================================================

import { dbAdmin, schema } from '@/lib/db'

export interface AuditPayload {
  /** El tenant al que pertenece la acción. NULL para acciones de platform_admin. */
  tenantId?: string | null
  /** El usuario que ejecutó la acción. NULL si no hay sesión (cron, webhook). */
  actorId?: string | null
  /**
   * Acción ejecutada. Convención: `entidad.verbo`
   * Ejemplos: lead.create · lead.assign · lead.status_change ·
   *           lead.mark_lost · lead.contacted · user.invite
   */
  action: string
  /**
   * Entidad afectada.
   * Ejemplos: lead · user · tenant · equipo · modelo · meta · source
   */
  entity: string
  /** UUID de la entidad afectada, si aplica. */
  entityId?: string | null
  /** Datos extra de contexto (estado anterior/nuevo, nombre, etc.). */
  meta?: Record<string, unknown>
  /**
   * TRUE → visible en la UI del dueño (/configuracion?tab=audit).
   * FALSE → solo en DB / auditoría interna.
   * Default: false
   */
  visibleToDueno?: boolean
}

/**
 * Registra una acción en `audit_logs`.
 *
 * **Fire-and-forget**: llamar con `void logAudit(...)` desde server actions.
 * Los errores se capturan internamente — nunca rompen el flujo principal.
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  const {
    tenantId = null,
    actorId  = null,
    action,
    entity,
    entityId = null,
    meta,
    visibleToDueno = false,
  } = payload

  try {
    await dbAdmin.insert(schema.auditLogs).values({
      tenant_id:        tenantId,
      actor_id:         actorId,
      action,
      entity,
      entity_id:        entityId,
      meta:             meta ?? null,
      visible_to_dueno: visibleToDueno,
    })
  } catch (err) {
    // Nunca propagar — un fallo de auditoría no debe bloquear la operación principal
    console.error('[audit] Failed to log action:', action, err)
  }
}
