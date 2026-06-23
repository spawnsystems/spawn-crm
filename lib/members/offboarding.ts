/**
 * lib/members/offboarding.ts
 * Helpers para dar de baja a un miembro de forma limpia, sin dejar trabajo
 * huérfano ni accesos abiertos. Server-only.
 *
 *  - releaseMemberWorkload: libera leads activos (→ "Sin asignar" del equipo),
 *    cancela sus citas programadas y sus traspasos pendientes.
 *  - revokeAuthIfOrphaned: si el usuario ya no tiene NINGUNA membresía activa,
 *    le revoca el acceso (banea su login en Supabase y marca usuarios.activo=false).
 */

import { dbAdmin, schema } from '@/lib/db'
import { and, eq, or, inArray, notInArray } from 'drizzle-orm'
import { TERMINAL_STATUSES } from '@/lib/leads/constants'
import { createAdminClient } from '@/lib/supabase/admin'

export interface OffboardCounts {
  leads:        number
  appointments: number
  transfers:    number
}

/**
 * Libera el trabajo operativo de un miembro al darlo de baja:
 *  1. Sus leads ACTIVOS (no terminales) pasan a "Sin asignar" — assigned_to=NULL,
 *     conservando equipo_id, así caen en la bandeja "Sin asignar" de su equipo
 *     (o en la bandeja general si no tenían equipo). Deja registro en el historial.
 *  2. Sus citas 'programada' se cancelan (no puede atenderlas; quien tome el lead
 *     reagenda).
 *  3. Sus traspasos 'pendiente' (enviados o recibidos) se cancelan.
 * Los leads terminales (VENTA / baja) quedan como están: son registro histórico.
 */
export async function releaseMemberWorkload(
  tenantId: string,
  userId:   string,
  actorId:  string,
): Promise<OffboardCounts> {
  // 1) Leads activos → "Sin asignar"
  const activos = await dbAdmin
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenant_id, tenantId),
      eq(schema.leads.assigned_to, userId),
      notInArray(schema.leads.status, [...TERMINAL_STATUSES]),
    ))

  if (activos.length > 0) {
    const ids = activos.map((l) => l.id)
    await dbAdmin
      .update(schema.leads)
      .set({ assigned_to: null, updated_by: actorId })
      .where(inArray(schema.leads.id, ids))

    await dbAdmin.insert(schema.leadTimeline).values(
      ids.map((leadId) => ({
        tenant_id:  tenantId,
        lead_id:    leadId,
        actor_id:   actorId,
        event_type: 'reassigned',
        title:      'Liberado a "Sin asignar" (baja del responsable)',
      })),
    )
  }

  // 2) Citas programadas → canceladas
  const appts = await dbAdmin
    .update(schema.leadAppointments)
    .set({ status: 'cancelada', updated_at: new Date() })
    .where(and(
      eq(schema.leadAppointments.tenant_id, tenantId),
      eq(schema.leadAppointments.vendedor_id, userId),
      eq(schema.leadAppointments.status, 'programada'),
    ))
    .returning({ id: schema.leadAppointments.id })

  // 3) Traspasos pendientes (enviados o recibidos) → cancelados
  const transfers = await dbAdmin
    .update(schema.leadTransfers)
    .set({ status: 'cancelada', responded_at: new Date() })
    .where(and(
      eq(schema.leadTransfers.tenant_id, tenantId),
      eq(schema.leadTransfers.status, 'pendiente'),
      or(
        eq(schema.leadTransfers.from_user_id, userId),
        eq(schema.leadTransfers.to_user_id, userId),
      ),
    ))
    .returning({ id: schema.leadTransfers.id })

  return { leads: activos.length, appointments: appts.length, transfers: transfers.length }
}

/**
 * Revoca el acceso del usuario SOLO si ya no le queda ninguna membresía activa
 * (en ningún tenant). Así un usuario que sigue trabajando en otra empresa no se
 * ve afectado. Banea su login en Supabase (invalida sesiones + bloquea nuevos
 * ingresos) y marca usuarios.activo=false. Devuelve true si revocó.
 */
export async function revokeAuthIfOrphaned(userId: string): Promise<boolean> {
  const otrasActivas = await dbAdmin
    .select({ uid: schema.tenantMembers.user_id })
    .from(schema.tenantMembers)
    .where(and(
      eq(schema.tenantMembers.user_id, userId),
      eq(schema.tenantMembers.activo, true),
    ))
    .limit(1)

  if (otrasActivas.length > 0) return false // sigue activo en otro tenant

  try {
    const adminClient = createAdminClient()
    await adminClient.auth.admin.updateUserById(userId, { ban_duration: '87600h' })
  } catch (err) {
    // Si falla el baneo no abortamos: el bloqueo de login a nivel app (signIn)
    // y el muro de "Cuenta pendiente" igual le cierran el acceso a los datos.
    console.error('[revokeAuthIfOrphaned] ban', err)
  }

  await dbAdmin
    .update(schema.usuarios)
    .set({ activo: false })
    .where(eq(schema.usuarios.id, userId))

  return true
}

/**
 * Inverso de revokeAuthIfOrphaned: al reactivar a un miembro, le devuelve el
 * acceso (quita el baneo de Supabase y marca usuarios.activo=true). No restaura
 * su carga de trabajo previa (los leads liberados ya están en "Sin asignar").
 */
export async function restoreAuthAccess(userId: string): Promise<void> {
  try {
    const adminClient = createAdminClient()
    await adminClient.auth.admin.updateUserById(userId, { ban_duration: 'none' })
  } catch (err) {
    console.error('[restoreAuthAccess] unban', err)
  }

  await dbAdmin
    .update(schema.usuarios)
    .set({ activo: true })
    .where(eq(schema.usuarios.id, userId))
}
