'use server'

import { revalidatePath } from 'next/cache'
import { dbAdmin, schema } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { eq, and, desc } from 'drizzle-orm'
import { requireTenant, appendTimeline } from '@/lib/leads/server-helpers'
import { z } from 'zod'
import type { ActionResult } from './auth'

// ── Schemas ───────────────────────────────────────────────────────────────────

const requestTransferSchema = z.object({
  leadId:   z.string().uuid(),
  toUserId: z.string().uuid(),
  motivo:   z.string().min(3).max(500).optional(),
})

// ── resolveTransferApprover ─────────────────────────────────────────────────────
// Quién debe aprobar un traspaso de un lead, con precedencia:
//   supervisor del equipo → gerente del equipo → dueño del tenant.
// Devuelve null si no hay ningún responsable (no debería pasar en un tenant sano).

async function resolveTransferApprover(
  tenantId: string,
  equipoId: string | null,
): Promise<string | null> {
  if (equipoId) {
    const [equipo] = await dbAdmin
      .select({
        supervisor_id: schema.equipos.supervisor_id,
        gerente_id:    schema.equipos.gerente_id,
      })
      .from(schema.equipos)
      .where(and(eq(schema.equipos.id, equipoId), eq(schema.equipos.tenant_id, tenantId)))
      .limit(1)

    if (equipo?.supervisor_id) return equipo.supervisor_id
    if (equipo?.gerente_id)    return equipo.gerente_id
  }

  // Fallback: el dueño del tenant.
  const [dueno] = await dbAdmin
    .select({ user_id: schema.tenantMembers.user_id })
    .from(schema.tenantMembers)
    .where(and(
      eq(schema.tenantMembers.tenant_id, tenantId),
      eq(schema.tenantMembers.rol, 'dueno'),
      eq(schema.tenantMembers.activo, true),
    ))
    .limit(1)

  return dueno?.user_id ?? null
}

// ── requestTransfer ───────────────────────────────────────────────────────────
// Solo el vendedor actualmente asignado puede solicitar un traspaso.
// El traspaso queda PENDIENTE DE APROBACIÓN del supervisor del equipo (o gerente
// / dueño si no hay supervisor). El receptor no acepta nada; se entera cuando se
// aprueba.

export async function requestTransfer(
  input: unknown,
): Promise<ActionResult<{ transferId: string }>> {
  const { user, tenantId } = await requireTenant()

  const parsed = requestTransferSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { leadId, toUserId, motivo } = parsed.data

  if (toUserId === user.id) {
    return { success: false, error: 'No podés transferirte el lead a vos mismo' }
  }

  // Verificar que el lead existe y está asignado al usuario actual
  const [lead] = await dbAdmin
    .select({
      assigned_to: schema.leads.assigned_to,
      nombre:      schema.leads.nombre,
      equipo_id:   schema.leads.equipo_id,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenant_id, tenantId)))
    .limit(1)

  if (!lead) return { success: false, error: 'Lead no encontrado' }
  if (lead.assigned_to !== user.id) {
    return { success: false, error: 'Solo el vendedor asignado puede solicitar un traspaso' }
  }

  // Obtener info del destinatario
  const [toUser] = await dbAdmin
    .select({ nombre: schema.usuarios.nombre, alias: schema.usuarios.alias })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, toUserId))
    .limit(1)

  if (!toUser) return { success: false, error: 'Vendedor destinatario no encontrado' }

  // Resolver quién aprueba. Sin responsable no se puede encolar la aprobación.
  const approverId = await resolveTransferApprover(tenantId, lead.equipo_id)
  if (!approverId) {
    return { success: false, error: 'No hay un supervisor o responsable que pueda aprobar el traspaso' }
  }

  // Insertar traspaso (puede fallar por índice único si ya hay uno pendiente)
  let transferId: string
  try {
    const [transfer] = await dbAdmin
      .insert(schema.leadTransfers)
      .values({
        tenant_id:    tenantId,
        lead_id:      leadId,
        from_user_id: user.id,
        to_user_id:   toUserId,
        approver_id:  approverId,
        status:       'pendiente',
        motivo:       motivo ?? null,
      })
      .returning({ id: schema.leadTransfers.id })

    transferId = transfer.id
  } catch {
    return { success: false, error: 'Ya hay un traspaso pendiente para este lead' }
  }

  const fromName = user.alias || user.nombre
  const toName   = toUser.alias || toUser.nombre

  // Notificar al aprobador (supervisor/gerente/dueño) para que lo apruebe.
  await dbAdmin.insert(schema.notifications).values({
    tenant_id: tenantId,
    user_id:   approverId,
    kind:      'transfer_request',
    title:     `Traspaso para aprobar — ${lead.nombre}`,
    body:      motivo
      ? `${fromName} quiere transferir el lead a ${toName}: "${motivo}"`
      : `${fromName} quiere transferir el lead a ${toName}.`,
    entity:    'lead_transfer',
    entity_id: transferId,
  })

  // Timeline en el lead
  void appendTimeline(
    tenantId, leadId, user.id,
    'transfer_requested',
    `Traspaso solicitado a ${toName} (pendiente de aprobación)`,
    motivo,
  )

  revalidatePath('/bandeja')
  revalidatePath('/leads')

  return { success: true, data: { transferId } }
}

// ── approveTransfer ───────────────────────────────────────────────────────────
// Solo el aprobador designado (supervisor/gerente/dueño) puede aprobar.
// Reasigna el lead al receptor y notifica a solicitante y receptor.

export async function approveTransfer(
  transferId: string,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()

  const [transfer] = await dbAdmin
    .select()
    .from(schema.leadTransfers)
    .where(and(
      eq(schema.leadTransfers.id, transferId),
      eq(schema.leadTransfers.tenant_id, tenantId),
      eq(schema.leadTransfers.approver_id, user.id),
      eq(schema.leadTransfers.status, 'pendiente'),
    ))
    .limit(1)

  if (!transfer) return { success: false, error: 'Traspaso no encontrado o no podés aprobarlo' }

  // Info del lead y del receptor para timeline/notificaciones
  const [lead] = await dbAdmin
    .select({ nombre: schema.leads.nombre })
    .from(schema.leads)
    .where(eq(schema.leads.id, transfer.lead_id))
    .limit(1)

  const [toUser] = await dbAdmin
    .select({ nombre: schema.usuarios.nombre, alias: schema.usuarios.alias })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, transfer.to_user_id))
    .limit(1)

  const toName  = toUser?.alias || toUser?.nombre || 'el vendedor'
  const supName = user.alias || user.nombre

  // Reasignar el lead al receptor
  await dbAdmin
    .update(schema.leads)
    .set({ assigned_to: transfer.to_user_id, updated_by: user.id })
    .where(eq(schema.leads.id, transfer.lead_id))

  // Marcar como aceptado (aprobado)
  await dbAdmin
    .update(schema.leadTransfers)
    .set({ status: 'aceptada', responded_at: new Date() })
    .where(eq(schema.leadTransfers.id, transferId))

  // Notificar al solicitante
  await dbAdmin.insert(schema.notifications).values({
    tenant_id: tenantId,
    user_id:   transfer.from_user_id,
    kind:      'transfer_approved',
    title:     `Traspaso aprobado — ${lead?.nombre ?? 'Lead'}`,
    body:      `${supName} aprobó el traspaso. El lead pasó a ${toName}.`,
    entity:    'lead_transfer',
    entity_id: transferId,
  })

  // Notificar al receptor (le quedó asignado el lead)
  await dbAdmin.insert(schema.notifications).values({
    tenant_id: tenantId,
    user_id:   transfer.to_user_id,
    kind:      'transfer_approved',
    title:     `Nuevo lead asignado — ${lead?.nombre ?? 'Lead'}`,
    body:      `${supName} te asignó este lead por un traspaso aprobado.`,
    entity:    'lead_transfer',
    entity_id: transferId,
  })

  // Timeline
  void appendTimeline(
    tenantId, transfer.lead_id, user.id,
    'transfer_accepted',
    `Traspaso aprobado por ${supName} — asignado a ${toName}`,
  )

  revalidatePath('/bandeja')
  revalidatePath('/leads')
  revalidatePath('/all-leads')

  return { success: true, data: undefined }
}

// ── rejectTransfer ────────────────────────────────────────────────────────────
// Solo el aprobador designado puede rechazar.

export async function rejectTransfer(
  transferId: string,
  motivo?: string,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()

  const [transfer] = await dbAdmin
    .select()
    .from(schema.leadTransfers)
    .where(and(
      eq(schema.leadTransfers.id, transferId),
      eq(schema.leadTransfers.tenant_id, tenantId),
      eq(schema.leadTransfers.approver_id, user.id),
      eq(schema.leadTransfers.status, 'pendiente'),
    ))
    .limit(1)

  if (!transfer) return { success: false, error: 'Traspaso no encontrado o no podés rechazarlo' }

  const [lead] = await dbAdmin
    .select({ nombre: schema.leads.nombre })
    .from(schema.leads)
    .where(eq(schema.leads.id, transfer.lead_id))
    .limit(1)

  // Marcar como rechazado
  await dbAdmin
    .update(schema.leadTransfers)
    .set({ status: 'rechazada', responded_at: new Date() })
    .where(eq(schema.leadTransfers.id, transferId))

  // Notificar al solicitante
  await dbAdmin.insert(schema.notifications).values({
    tenant_id: tenantId,
    user_id:   transfer.from_user_id,
    kind:      'transfer_rejected',
    title:     `Traspaso rechazado — ${lead?.nombre ?? 'Lead'}`,
    body:      motivo
      ? `${user.alias || user.nombre} rechazó el traspaso: "${motivo}"`
      : `${user.alias || user.nombre} rechazó el traspaso.`,
    entity:    'lead_transfer',
    entity_id: transferId,
  })

  // Timeline
  void appendTimeline(
    tenantId, transfer.lead_id, user.id,
    'transfer_rejected',
    `Traspaso rechazado`,
    motivo,
  )

  revalidatePath('/bandeja')

  return { success: true, data: undefined }
}

// ── cancelTransfer ────────────────────────────────────────────────────────────

export async function cancelTransfer(
  transferId: string,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()

  const [transfer] = await dbAdmin
    .select()
    .from(schema.leadTransfers)
    .where(and(
      eq(schema.leadTransfers.id, transferId),
      eq(schema.leadTransfers.tenant_id, tenantId),
      eq(schema.leadTransfers.from_user_id, user.id),
      eq(schema.leadTransfers.status, 'pendiente'),
    ))
    .limit(1)

  if (!transfer) return { success: false, error: 'Traspaso no encontrado o ya no se puede cancelar' }

  await dbAdmin
    .update(schema.leadTransfers)
    .set({ status: 'cancelada', responded_at: new Date() })
    .where(eq(schema.leadTransfers.id, transferId))

  void appendTimeline(
    tenantId, transfer.lead_id, user.id,
    'transfer_cancelled',
    `Solicitud de traspaso cancelada`,
  )

  revalidatePath('/bandeja')
  revalidatePath('/leads')

  return { success: true, data: undefined }
}

// ── getTransfersToApprove ─────────────────────────────────────────────────────
// Traspasos pendientes que el usuario actual debe aprobar (es el approver_id).

export async function getTransfersToApprove() {
  const { user, tenantId } = await requireTenant()

  const fromU = alias(schema.usuarios, 'from_u')
  const toU   = alias(schema.usuarios, 'to_u')

  const rows = await dbAdmin
    .select({
      id:          schema.leadTransfers.id,
      lead_id:     schema.leadTransfers.lead_id,
      status:      schema.leadTransfers.status,
      motivo:      schema.leadTransfers.motivo,
      created_at:  schema.leadTransfers.created_at,
      lead_nombre: schema.leads.nombre,
      lead_modelo: schema.leads.modelo,
      lead_status: schema.leads.status,
      from_nombre: fromU.nombre,
      from_alias:  fromU.alias,
      to_nombre:   toU.nombre,
      to_alias:    toU.alias,
    })
    .from(schema.leadTransfers)
    .leftJoin(schema.leads, eq(schema.leadTransfers.lead_id,      schema.leads.id))
    .leftJoin(fromU,        eq(schema.leadTransfers.from_user_id, fromU.id))
    .leftJoin(toU,          eq(schema.leadTransfers.to_user_id,   toU.id))
    .where(and(
      eq(schema.leadTransfers.tenant_id,   tenantId),
      eq(schema.leadTransfers.approver_id, user.id),
      eq(schema.leadTransfers.status,      'pendiente'),
    ))
    .orderBy(desc(schema.leadTransfers.created_at))

  return rows
}

// ── getMySentTransfers ────────────────────────────────────────────────────────
// Traspasos que el usuario actual solicitó (pendientes, para poder cancelarlos).

export async function getMySentTransfers() {
  const { user, tenantId } = await requireTenant()

  const rows = await dbAdmin
    .select({
      id:         schema.leadTransfers.id,
      lead_id:    schema.leadTransfers.lead_id,
      status:     schema.leadTransfers.status,
      created_at: schema.leadTransfers.created_at,
      lead_nombre: schema.leads.nombre,
      to_nombre:   schema.usuarios.nombre,
      to_alias:    schema.usuarios.alias,
    })
    .from(schema.leadTransfers)
    .leftJoin(schema.leads,    eq(schema.leadTransfers.lead_id,    schema.leads.id))
    .leftJoin(schema.usuarios, eq(schema.leadTransfers.to_user_id, schema.usuarios.id))
    .where(and(
      eq(schema.leadTransfers.tenant_id, tenantId),
      eq(schema.leadTransfers.from_user_id, user.id),
      eq(schema.leadTransfers.status, 'pendiente'),
    ))
    .orderBy(desc(schema.leadTransfers.created_at))

  return rows
}
