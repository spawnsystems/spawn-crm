'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, and, desc } from 'drizzle-orm'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { dbAdmin, schema } from '@/lib/db'
import { requireTenant, appendTimeline, assertLeadAccess } from '@/lib/leads/server-helpers'
import { advanceStatus, isTerminal, terminalBlockReason } from '@/lib/leads/state-machine'
import type { ActionResult } from './auth'

// ── Schemas ───────────────────────────────────────────────────────────────────

const scheduleCallSchema = z.object({
  leadId:       z.string().uuid(),
  scheduledAt:  z.string().datetime({ offset: true }),
  notasPrevias: z.string().max(500).optional(),
})

const registerCallSchema = z.object({
  callId:           z.string().uuid(),
  outcome:          z.enum(['proxima_llamada', 'cita', 'descartado']),
  notasResultado:   z.string().max(1000).optional(),
  proximaLlamadaAt: z.string().datetime({ offset: true }).optional(),
})

// ── scheduleCall ──────────────────────────────────────────────────────────────

export async function scheduleCall(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { user, tenantId } = await requireTenant()

  const parsed = scheduleCallSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { leadId, scheduledAt, notasPrevias } = parsed.data

  const lead = await assertLeadAccess(leadId, user.id, user.rol, tenantId)
  if (!lead) return { success: false, error: 'No tenés acceso a este lead' }

  // No se puede agendar una llamada sobre un lead cerrado o dado de baja.
  if (isTerminal(lead.status)) {
    return { success: false, error: terminalBlockReason(lead.status) ?? 'El lead no admite cambios' }
  }

  const [row] = await dbAdmin
    .insert(schema.leadCalls)
    .values({
      tenant_id:    tenantId,
      lead_id:      leadId,
      created_by:   user.id,
      scheduled_at: new Date(scheduledAt),
      notas_previas: notasPrevias ?? null,
    })
    .returning({ id: schema.leadCalls.id })

  const fechaLabel = format(new Date(scheduledAt), "d 'de' MMM 'a las' HH:mm", { locale: es })
  await appendTimeline(
    tenantId, leadId, user.id,
    'call_scheduled',
    `Llamada agendada para el ${fechaLabel}`,
    notasPrevias ?? undefined,
  )

  // Avance de etapa: coordinar una llamada lleva el lead a HORARIO ASIGNADO.
  // advanceStatus nunca degrada (si ya está más adelante, no toca nada).
  const nextStatus = advanceStatus(lead.status, 'HORARIO ASIGNADO')
  if (nextStatus !== lead.status) {
    await dbAdmin.update(schema.leads)
      .set({ status: nextStatus, updated_by: user.id })
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenant_id, tenantId)))
  }

  revalidatePath('/leads')
  revalidatePath('/pipeline')
  revalidatePath('/all-leads')
  return { success: true, data: { id: row.id } }
}

// ── registerCall ──────────────────────────────────────────────────────────────

export async function registerCall(
  input: unknown,
): Promise<ActionResult<{ outcome: string }>> {
  const { user, tenantId } = await requireTenant()

  const parsed = registerCallSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { callId, outcome, notasResultado, proximaLlamadaAt } = parsed.data

  // Verificar que la llamada existe y pertenece al tenant
  const call = await dbAdmin
    .select()
    .from(schema.leadCalls)
    .where(and(eq(schema.leadCalls.id, callId), eq(schema.leadCalls.tenant_id, tenantId)))
    .limit(1)

  if (!call[0]) return { success: false, error: 'Llamada no encontrada' }
  if (call[0].realizada_at) return { success: false, error: 'Esta llamada ya fue registrada' }

  const leadId = call[0].lead_id

  // Scope: el usuario debe tener acceso al lead de la llamada (no solo al tenant)
  const lead = await assertLeadAccess(leadId, user.id, user.rol, tenantId)
  if (!lead) return { success: false, error: 'No tenés acceso a este lead' }

  // Marcar como realizada
  await dbAdmin
    .update(schema.leadCalls)
    .set({
      realizada_at:   new Date(),
      outcome,
      notas_resultado: notasResultado ?? null,
    })
    .where(eq(schema.leadCalls.id, callId))

  const outcomeLabel: Record<string, string> = {
    proxima_llamada: 'Se agendó próxima llamada',
    cita:            'Se pactó una cita',
    descartado:      'Lead a dar de baja',
  }

  await appendTimeline(
    tenantId, leadId, user.id,
    'call_registered',
    `Llamada registrada — ${outcomeLabel[outcome]}`,
    notasResultado ?? undefined,
  )

  // Si el outcome es próxima llamada y se indicó la fecha, la creamos acá
  if (outcome === 'proxima_llamada' && proximaLlamadaAt) {
    await dbAdmin.insert(schema.leadCalls).values({
      tenant_id:    tenantId,
      lead_id:      leadId,
      created_by:   user.id,
      scheduled_at: new Date(proximaLlamadaAt),
    })

    const fechaLabel = format(new Date(proximaLlamadaAt), "d 'de' MMM 'a las' HH:mm", { locale: es })
    await appendTimeline(
      tenantId, leadId, user.id,
      'call_scheduled',
      `Próxima llamada agendada: ${fechaLabel}`,
    )
  }

  return { success: true, data: { outcome } }
}

// ── getCallsForLead ───────────────────────────────────────────────────────────

export async function getCallsForLead(leadId: string) {
  const { tenantId } = await requireTenant()

  return dbAdmin
    .select()
    .from(schema.leadCalls)
    .where(and(
      eq(schema.leadCalls.lead_id, leadId),
      eq(schema.leadCalls.tenant_id, tenantId),
    ))
    .orderBy(desc(schema.leadCalls.created_at))
}
