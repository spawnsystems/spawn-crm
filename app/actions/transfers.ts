'use server'

import { revalidatePath } from 'next/cache'
import { dbAdmin, schema } from '@/lib/db'
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

// ── requestTransfer ───────────────────────────────────────────────────────────
// Solo el vendedor actualmente asignado puede solicitar un traspaso.
// Genera una notificación para el receptor.

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
    .select({ assigned_to: schema.leads.assigned_to, nombre: schema.leads.nombre })
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
        status:       'pendiente',
        motivo:       motivo ?? null,
      })
      .returning({ id: schema.leadTransfers.id })

    transferId = transfer.id
  } catch {
    return { success: false, error: 'Ya hay un traspaso pendiente para este lead' }
  }

  // Notificar al destinatario
  await dbAdmin.insert(schema.notifications).values({
    tenant_id: tenantId,
    user_id:   toUserId,
    kind:      'transfer_request',
    title:     `Solicitud de traspaso — ${lead.nombre}`,
    body:      motivo
      ? `${user.alias || user.nombre} quiere transferirte este lead: "${motivo}"`
      : `${user.alias || user.nombre} quiere transferirte este lead.`,
    entity:    'lead_transfer',
    entity_id: transferId,
  })

  // Timeline en el lead
  void appendTimeline(
    tenantId, leadId, user.id,
    'transfer_requested',
    `Traspaso solicitado a ${toUser.alias || toUser.nombre}`,
    motivo,
  )

  revalidatePath('/bandeja')
  revalidatePath('/leads')

  return { success: true, data: { transferId } }
}

// ── acceptTransfer ────────────────────────────────────────────────────────────

export async function acceptTransfer(
  transferId: string,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()

  const [transfer] = await dbAdmin
    .select()
    .from(schema.leadTransfers)
    .where(and(
      eq(schema.leadTransfers.id, transferId),
      eq(schema.leadTransfers.tenant_id, tenantId),
      eq(schema.leadTransfers.to_user_id, user.id),
      eq(schema.leadTransfers.status, 'pendiente'),
    ))
    .limit(1)

  if (!transfer) return { success: false, error: 'Traspaso no encontrado o ya respondido' }

  // Obtener nombre del lead para la notificación
  const [lead] = await dbAdmin
    .select({ nombre: schema.leads.nombre })
    .from(schema.leads)
    .where(eq(schema.leads.id, transfer.lead_id))
    .limit(1)

  // Reasignar el lead
  await dbAdmin
    .update(schema.leads)
    .set({ assigned_to: user.id, updated_by: user.id })
    .where(eq(schema.leads.id, transfer.lead_id))

  // Marcar como aceptado
  await dbAdmin
    .update(schema.leadTransfers)
    .set({ status: 'aceptada', responded_at: new Date() })
    .where(eq(schema.leadTransfers.id, transferId))

  // Notificar al solicitante
  await dbAdmin.insert(schema.notifications).values({
    tenant_id: tenantId,
    user_id:   transfer.from_user_id,
    kind:      'transfer_accepted',
    title:     `Traspaso aceptado — ${lead?.nombre ?? 'Lead'}`,
    body:      `${user.alias || user.nombre} aceptó el traspaso del lead.`,
    entity:    'lead_transfer',
    entity_id: transferId,
  })

  // Timeline
  void appendTimeline(
    tenantId, transfer.lead_id, user.id,
    'transfer_accepted',
    `Traspaso aceptado por ${user.alias || user.nombre}`,
  )

  revalidatePath('/bandeja')
  revalidatePath('/leads')
  revalidatePath('/all-leads')

  return { success: true, data: undefined }
}

// ── rejectTransfer ────────────────────────────────────────────────────────────

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
      eq(schema.leadTransfers.to_user_id, user.id),
      eq(schema.leadTransfers.status, 'pendiente'),
    ))
    .limit(1)

  if (!transfer) return { success: false, error: 'Traspaso no encontrado o ya respondido' }

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
      : `${user.alias || user.nombre} rechazó el traspaso del lead.`,
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

// ── getMyTransferRequests ─────────────────────────────────────────────────────
// Traspasos pendientes donde el usuario actual es el receptor.

export async function getMyTransferRequests() {
  const { user, tenantId } = await requireTenant()

  // Alias para el join de from_user (Drizzle no soporta 2 joins a la misma tabla fácilmente
  // sin alias; hacemos el join solo a from_user_id)
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
      from_nombre: schema.usuarios.nombre,
      from_alias:  schema.usuarios.alias,
    })
    .from(schema.leadTransfers)
    .leftJoin(schema.leads,    eq(schema.leadTransfers.lead_id,      schema.leads.id))
    .leftJoin(schema.usuarios, eq(schema.leadTransfers.from_user_id, schema.usuarios.id))
    .where(and(
      eq(schema.leadTransfers.tenant_id, tenantId),
      eq(schema.leadTransfers.to_user_id, user.id),
      eq(schema.leadTransfers.status, 'pendiente'),
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
