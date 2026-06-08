'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, gte, lte, ne, sql, isNull } from 'drizzle-orm'
import { requireTenant, appendTimeline, assertLeadAccess, cancelPendingCalls } from '@/lib/leads/server-helpers'
import { isBaja } from '@/lib/leads/constants'
import { advanceStatus } from '@/lib/leads/state-machine'
import { getCurrentUserTeamScope, buildAppointmentScopeWhere } from '@/lib/tenant/teams'
import { logAudit } from '@/lib/audit/log'
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  rescheduleAppointmentSchema,
  appointmentTipoValues,
  APPOINTMENT_TIPO_LABEL,
} from '@/lib/schemas/appointments'
import type { ActionResult } from './auth'

const BA_TZ = 'America/Argentina/Buenos_Aires'

/** Formatea un Date en horario Buenos Aires como "lunes 15 de junio a las 15:30 hs". */
function fmtApptDateBA(date: Date): string {
  return date.toLocaleString('es-AR', {
    timeZone:  BA_TZ,
    weekday:   'long',
    day:       'numeric',
    month:     'long',
    hour:      '2-digit',
    minute:    '2-digit',
    hour12:    false,
  }).replace(',', '')
}

// ── createAppointment ────────────────────────────────────────
// Crea una nueva cita para un lead. Side-effects:
//  1. INSERT en lead_appointments
//  2. Si el lead no está en una etapa ≥ ENTREVISTA PACTADA → status = 'ENTREVISTA PACTADA'
//  3. Si venía de baja/rescate → limpia baja + appendTimeline('reactivated_from_rescue')
//  4. appendTimeline('appointment_scheduled')
//  5. logAudit

export async function createAppointment(
  input: unknown,
): Promise<ActionResult<{ id: string; conflict?: boolean }>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const parsed = createAppointmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  // 1) Verificar que el lead existe + es accesible + obtener su equipo
  const lead = await dbAdmin
    .select({
      id:           schema.leads.id,
      status:       schema.leads.status,
      assigned_to:  schema.leads.assigned_to,
      equipo_id:    schema.leads.equipo_id,
      abandoned_at: schema.leads.abandoned_at,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, data.lead_id), forTenant(schema.leads)))
    .limit(1)

  if (!lead[0]) return { success: false, error: 'Lead no encontrado' }

  // Un lead vendido es terminal: no se le agendan citas.
  if (lead[0].status === 'VENTA') {
    return { success: false, error: 'El lead ya está vendido — es un estado final y no admite nuevas citas.' }
  }

  // Scope: el usuario debe tener acceso al lead (no solo al tenant)
  const accessible = await assertLeadAccess(data.lead_id, user.id, user.rol, tenantId)
  if (!accessible) return { success: false, error: 'No tenés acceso a este lead' }

  const vendedorId = data.vendedor_id ?? lead[0].assigned_to ?? user.id

  // 2) Resolver equipo del vendedor para denormalizar
  const member = await dbAdmin
    .select({ equipo_id: schema.tenantMembers.equipo_id })
    .from(schema.tenantMembers)
    .where(and(
      eq(schema.tenantMembers.tenant_id, tenantId),
      eq(schema.tenantMembers.user_id, vendedorId),
    ))
    .limit(1)
  const equipoId = member[0]?.equipo_id ?? lead[0].equipo_id ?? null

  // 3) Verificar que no exista otra cita 'programada' del mismo lead
  const existing = await dbAdmin
    .select({ id: schema.leadAppointments.id })
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.lead_id, data.lead_id),
      eq(schema.leadAppointments.status, 'programada'),
    ))
    .limit(1)
  if (existing[0]) {
    return {
      success: false,
      error:   'Ya hay una cita programada para este lead. Cancelala o reagendala primero.',
    }
  }

  // 4) Detectar conflicto horario del vendedor (warning, no bloquea)
  const windowStart = new Date(data.scheduled_at.getTime() - data.duration_min * 60_000)
  const windowEnd   = new Date(data.scheduled_at.getTime() + data.duration_min * 60_000)
  const conflict = await dbAdmin
    .select({ id: schema.leadAppointments.id })
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.vendedor_id, vendedorId),
      eq(schema.leadAppointments.status, 'programada'),
      gte(schema.leadAppointments.scheduled_at, windowStart),
      lte(schema.leadAppointments.scheduled_at, windowEnd),
    ))
    .limit(1)

  // 5) Insertar la cita
  const [row] = await q.insert(schema.leadAppointments).values({
    tenant_id:      tenantId,
    lead_id:        data.lead_id,
    vendedor_id:    vendedorId,
    equipo_id:      equipoId,
    scheduled_at:   data.scheduled_at,
    duration_min:   data.duration_min,
    tipo:           data.tipo,
    lugar:          data.lugar          ?? null,
    modelo_interes: data.modelo_interes ?? null,
    notas:          data.notas          ?? null,
    created_by:     user.id,
  }).returning({ id: schema.leadAppointments.id })

  // 6) Side-effect sobre el lead: avanzar a 'ENTREVISTA PACTADA' si corresponde.
  //    No degradamos si ya está en una etapa igual o posterior.
  const previousStatus = lead[0].status
  const cameFromRescue = isBaja(previousStatus) || lead[0].abandoned_at !== null
  const yaAvanzado     = ['ENTREVISTA PACTADA', 'CIERRE', 'VENTA'].includes(previousStatus)

  if (!yaAvanzado) {
    await q.update(schema.leads)
      .set({
        status:                'ENTREVISTA PACTADA',
        last_contact_at:       new Date(),
        last_contact_critical: false,
        at_risk:               false,
        // si venía de baja/rescate, lo reactivamos limpiando esos campos
        ...(cameFromRescue ? { abandoned_at: null, baja_motivo: null, baja_at: null } : {}),
        updated_by:            user.id,
      })
      .where(and(eq(schema.leads.id, data.lead_id), forTenant(schema.leads)))

    if (cameFromRescue) {
      await appendTimeline(
        tenantId, data.lead_id, user.id,
        'reactivated_from_rescue',
        'Reactivado — volvió al seguimiento activo',
      )
    }
    // No agregamos evento 'status_changed' separado: el appointment_scheduled
    // ya cubre el avance de etapa en el historial visible al vendedor.
  }

  await appendTimeline(
    tenantId, data.lead_id, user.id,
    'appointment_scheduled',
    'Cita pautada con el cliente',
    `${APPOINTMENT_TIPO_LABEL[data.tipo]} · ${fmtApptDateBA(data.scheduled_at)}`,
  )

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'appointment.create',
    entity:         'appointment',
    entityId:       row.id,
    meta:           {
      lead_id:      data.lead_id,
      scheduled_at: data.scheduled_at,
      tipo:         data.tipo,
    },
    visibleToDueno: true,
  })

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  revalidatePath('/citas')
  revalidatePath('/pipeline')
  revalidatePath('/rescate')

  return { success: true, data: { id: row.id, conflict: !!conflict[0] } }
}

// ── updateAppointment ────────────────────────────────────────

export async function updateAppointment(
  appointmentId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()

  const parsed = updateAppointmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  if (Object.keys(data).length === 0) return { success: true, data: undefined }

  // Scope: cargar la cita y verificar acceso al lead
  const appt = await dbAdmin
    .select({ lead_id: schema.leadAppointments.lead_id })
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))
    .limit(1)
  if (!appt[0]) return { success: false, error: 'Cita no encontrada' }
  const accessible = await assertLeadAccess(appt[0].lead_id, user.id, user.rol, tenantId)
  if (!accessible) return { success: false, error: 'No tenés acceso a esta cita' }

  await dbAdmin.update(schema.leadAppointments)
    .set({
      ...(data.scheduled_at   !== undefined ? { scheduled_at:   data.scheduled_at }   : {}),
      ...(data.duration_min   !== undefined ? { duration_min:   data.duration_min }   : {}),
      ...(data.tipo           !== undefined ? { tipo:           data.tipo }           : {}),
      ...(data.lugar          !== undefined ? { lugar:          data.lugar }          : {}),
      ...(data.modelo_interes !== undefined ? { modelo_interes: data.modelo_interes } : {}),
      ...(data.notas          !== undefined ? { notas:          data.notas }          : {}),
      updated_at: new Date(),
    })
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))

  void logAudit({
    tenantId, actorId: user.id,
    action:   'appointment.update',
    entity:   'appointment',
    entityId: appointmentId,
    meta:     data,
  })

  revalidatePath('/citas')
  revalidatePath('/leads')
  return { success: true, data: undefined }
}

// ── cancelAppointment ────────────────────────────────────────

export async function cancelAppointment(
  appointmentId: string,
  reason?:       string,
): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const appt = await dbAdmin
    .select({ lead_id: schema.leadAppointments.lead_id })
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))
    .limit(1)
  if (!appt[0]) return { success: false, error: 'Cita no encontrada' }
  const leadRow = await assertLeadAccess(appt[0].lead_id, user.id, user.rol, tenantId)
  if (!leadRow) return { success: false, error: 'No tenés acceso a esta cita' }

  await dbAdmin.update(schema.leadAppointments)
    .set({
      status:        'cancelada',
      outcome_notes: reason?.trim() ?? null,
      updated_at:    new Date(),
    })
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))

  // Cancelar la cita retrocede el lead de ENTREVISTA PACTADA:
  //  - con llamada pendiente → HORARIO ASIGNADO (hay un horario coordinado: la llamada)
  //  - sin llamada pendiente → GESTION (nada pactado, vuelve a gestión activa)
  // Reagendar es otra acción que NO pasa por acá y mantiene la etapa.
  let regressStatus: 'GESTION' | 'HORARIO ASIGNADO' | null = null
  if (leadRow.status === 'ENTREVISTA PACTADA') {
    const hasPendingCall = await dbAdmin
      .select({ id: schema.leadCalls.id })
      .from(schema.leadCalls)
      .where(and(
        eq(schema.leadCalls.lead_id, appt[0].lead_id),
        isNull(schema.leadCalls.realizada_at),
        isNull(schema.leadCalls.canceled_at),
      ))
      .limit(1)
    regressStatus = hasPendingCall[0] ? 'HORARIO ASIGNADO' : 'GESTION'
    await q.update(schema.leads)
      .set({ status: regressStatus, updated_by: user.id })
      .where(and(eq(schema.leads.id, appt[0].lead_id), forTenant(schema.leads)))
  }

  await appendTimeline(
    tenantId, appt[0].lead_id, user.id,
    'appointment_cancelled',
    regressStatus === 'HORARIO ASIGNADO'
      ? 'Cita cancelada — vuelve a recoordinar'
      : regressStatus === 'GESTION'
      ? 'Cita cancelada — vuelve a gestión activa'
      : 'Cita cancelada',
    reason?.trim(),
  )

  void logAudit({
    tenantId, actorId: user.id,
    action: 'appointment.cancel', entity: 'appointment', entityId: appointmentId,
    meta:   { reason },
    visibleToDueno: true,
  })

  revalidatePath('/citas')
  revalidatePath('/leads')
  return { success: true, data: undefined }
}

// ── markAppointmentDone ──────────────────────────────────────

export async function markAppointmentDone(
  appointmentId: string,
  outcomeNotes?: string,
): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const appt = await dbAdmin
    .select({ lead_id: schema.leadAppointments.lead_id, tipo: schema.leadAppointments.tipo })
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))
    .limit(1)
  if (!appt[0]) return { success: false, error: 'Cita no encontrada' }
  const leadRow = await assertLeadAccess(appt[0].lead_id, user.id, user.rol, tenantId)
  if (!leadRow) return { success: false, error: 'No tenés acceso a esta cita' }

  await dbAdmin.update(schema.leadAppointments)
    .set({
      status:        'realizada',
      outcome_notes: outcomeNotes?.trim() ?? null,
      updated_at:    new Date(),
    })
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))

  // La cita realizada cuenta como contacto y avanza la etapa a CIERRE
  // (entró en negociación). advanceStatus no degrada si ya está más adelante.
  const nextStatus = advanceStatus(leadRow.status, 'CIERRE')
  await q.update(schema.leads)
    .set({
      status:                nextStatus,
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      updated_by:            user.id,
    })
    .where(and(eq(schema.leads.id, appt[0].lead_id), forTenant(schema.leads)))

  await appendTimeline(
    tenantId, appt[0].lead_id, user.id,
    'appointment_done',
    nextStatus === 'CIERRE' && leadRow.status !== 'CIERRE'
      ? 'Cita realizada — en proceso de cierre'
      : 'Cita realizada',
    outcomeNotes?.trim() ?? `${APPOINTMENT_TIPO_LABEL[appt[0].tipo]} completado`,
  )

  void logAudit({
    tenantId, actorId: user.id,
    action: 'appointment.done', entity: 'appointment', entityId: appointmentId,
    visibleToDueno: true,
  })

  revalidatePath('/citas')
  revalidatePath('/leads')
  return { success: true, data: undefined }
}

// ── markAppointmentNoShow ────────────────────────────────────

export async function markAppointmentNoShow(
  appointmentId: string,
  notes?:        string,
): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const appt = await dbAdmin
    .select({ lead_id: schema.leadAppointments.lead_id })
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))
    .limit(1)
  if (!appt[0]) return { success: false, error: 'Cita no encontrada' }
  const leadRow = await assertLeadAccess(appt[0].lead_id, user.id, user.rol, tenantId)
  if (!leadRow) return { success: false, error: 'No tenés acceso a esta cita' }

  await dbAdmin.update(schema.leadAppointments)
    .set({
      status:        'no_se_presento',
      outcome_notes: notes?.trim() ?? null,
      updated_at:    new Date(),
    })
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))

  // Si el lead estaba en ENTREVISTA PACTADA, la cita falló. Retrocede:
  //  - con llamada pendiente → HORARIO ASIGNADO (hay un horario coordinado: la llamada)
  //  - sin llamada pendiente → GESTION (nada pactado, vuelve a gestión activa)
  let regressStatus: 'GESTION' | 'HORARIO ASIGNADO' | null = null
  if (leadRow.status === 'ENTREVISTA PACTADA') {
    const hasPendingCall = await dbAdmin
      .select({ id: schema.leadCalls.id })
      .from(schema.leadCalls)
      .where(and(
        eq(schema.leadCalls.lead_id, appt[0].lead_id),
        isNull(schema.leadCalls.realizada_at),
        isNull(schema.leadCalls.canceled_at),
      ))
      .limit(1)
    regressStatus = hasPendingCall[0] ? 'HORARIO ASIGNADO' : 'GESTION'
    await q.update(schema.leads)
      .set({ status: regressStatus, updated_by: user.id })
      .where(and(eq(schema.leads.id, appt[0].lead_id), forTenant(schema.leads)))
  }

  await appendTimeline(
    tenantId, appt[0].lead_id, user.id,
    'appointment_no_show',
    regressStatus === 'HORARIO ASIGNADO'
      ? 'No se presentó — vuelve a recoordinar'
      : regressStatus === 'GESTION'
      ? 'No se presentó — vuelve a gestión activa'
      : 'No se presentó a la cita',
    notes?.trim(),
  )

  void logAudit({
    tenantId, actorId: user.id,
    action: 'appointment.no_show', entity: 'appointment', entityId: appointmentId,
    visibleToDueno: true,
  })

  revalidatePath('/citas')
  revalidatePath('/leads')
  return { success: true, data: undefined }
}

// ── rescheduleAppointment ────────────────────────────────────
// Marca la cita vieja como 'reagendada' y crea una nueva 'programada'
// con los mismos datos pero la fecha nueva. Mantiene el lead en 'Citado'.

export async function rescheduleAppointment(
  appointmentId: string,
  input: unknown,
): Promise<ActionResult<{ newId: string }>> {
  const { user, tenantId } = await requireTenant()

  const parsed = rescheduleAppointmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const data = parsed.data

  const original = await dbAdmin
    .select()
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))
    .limit(1)
  if (!original[0]) return { success: false, error: 'Cita no encontrada' }
  if (!await assertLeadAccess(original[0].lead_id, user.id, user.rol, tenantId))
    return { success: false, error: 'No tenés acceso a esta cita' }

  // Marcar la vieja como reagendada (libera el constraint único)
  await dbAdmin.update(schema.leadAppointments)
    .set({ status: 'reagendada', updated_at: new Date() })
    .where(eq(schema.leadAppointments.id, appointmentId))

  // Crear la nueva con los mismos datos + fecha nueva
  const o = original[0]
  const [row] = await dbAdmin.insert(schema.leadAppointments).values({
    tenant_id:      tenantId,
    lead_id:        o.lead_id,
    vendedor_id:    o.vendedor_id,
    equipo_id:      o.equipo_id,
    scheduled_at:   data.newScheduledAt,
    duration_min:   data.newDuration ?? o.duration_min,
    tipo:           o.tipo,
    lugar:          o.lugar,
    modelo_interes: o.modelo_interes,
    notas:          o.notas,
    created_by:     user.id,
  }).returning({ id: schema.leadAppointments.id })

  await appendTimeline(
    tenantId, o.lead_id, user.id,
    'appointment_rescheduled',
    'Cita reagendada',
    `${APPOINTMENT_TIPO_LABEL[o.tipo]} · ${fmtApptDateBA(data.newScheduledAt)}`,
  )

  void logAudit({
    tenantId, actorId: user.id,
    action: 'appointment.reschedule', entity: 'appointment', entityId: row.id,
    meta:   { from: o.scheduled_at, to: data.newScheduledAt, original_id: appointmentId },
    visibleToDueno: true,
  })

  revalidatePath('/citas')
  revalidatePath('/leads')
  return { success: true, data: { newId: row.id } }
}

// ── resolveAppointment ───────────────────────────────────────
// Flujo unificado de "resultado de cita" (análogo a registerCall). Una cita
// ya realizada/pasada se resuelve eligiendo qué pasó; cada outcome define el
// estado resultante del lead y el próximo paso:
//
//   avanzo       → cita realizada · lead → CIERRE · EXIGE próxima acción
//                  (cita de cierre o llamada de seguimiento). Nunca queda "en
//                  la nada": siempre sale con un próximo paso agendado.
//   otra_reunion → cita realizada · se mantiene en ENTREVISTA PACTADA (todavía
//                  en fase de entrevistas) · agenda una nueva cita.
//   no_show      → cita no_se_presento · lead retrocede (HORARIO/GESTIÓN) ·
//                  reintento de llamada opcional. No cuenta como contacto.
//   venta        → cita realizada · lead → CIERRE · el cliente abre el diálogo
//                  de Registrar venta (openVenta=true).
//   no_prospero  → cita realizada (la entrevista se hizo) · el cliente abre el
//                  diálogo de Dar de baja (openBaja=true).

const resolveAppointmentSchema = z.object({
  outcome: z.enum(['avanzo', 'otra_reunion', 'no_show', 'venta', 'no_prospero']),
  notes:   z.string().max(2000).optional(),
  // Próxima acción para 'avanzo' (cita o llamada) y 'otra_reunion' (cita).
  nextAction: z.object({
    kind:         z.enum(['cita', 'llamada']),
    scheduled_at: z.string().datetime({ offset: true }),
    tipo:         z.enum(appointmentTipoValues).optional(),
    duration_min: z.number().int().min(15).max(240).optional(),
    lugar:        z.string().max(200).optional(),
    notas:        z.string().max(2000).optional(),
  }).optional(),
  // Reintento de llamada opcional para 'no_show'.
  retryCallAt: z.string().datetime({ offset: true }).optional(),
}).superRefine((val, ctx) => {
  if ((val.outcome === 'avanzo' || val.outcome === 'otra_reunion') && !val.nextAction) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nextAction'], message: 'Indicá la próxima acción.' })
  }
  if (val.outcome === 'otra_reunion' && val.nextAction && val.nextAction.kind !== 'cita') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nextAction', 'kind'], message: 'Otra reunión requiere agendar una cita.' })
  }
  if (val.nextAction?.kind === 'cita' && !val.nextAction.tipo) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nextAction', 'tipo'], message: 'Elegí el tipo de cita.' })
  }
})

export async function resolveAppointment(
  appointmentId: string,
  input: unknown,
): Promise<ActionResult<{ outcome: string; openVenta: boolean; openBaja: boolean }>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const parsed = resolveAppointmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { outcome, notes, nextAction, retryCallAt } = parsed.data

  const rows = await dbAdmin
    .select()
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.id, appointmentId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))
    .limit(1)
  const apptRow = rows[0]
  if (!apptRow) return { success: false, error: 'Cita no encontrada' }

  const leadRow = await assertLeadAccess(apptRow.lead_id, user.id, user.rol, tenantId)
  if (!leadRow) return { success: false, error: 'No tenés acceso a esta cita' }

  const leadId     = apptRow.lead_id
  const apptStatus = outcome === 'no_show' ? 'no_se_presento' as const : 'realizada' as const

  // 1) Marcar la cita resuelta
  await dbAdmin.update(schema.leadAppointments)
    .set({ status: apptStatus, outcome_notes: notes?.trim() ?? null, updated_at: new Date() })
    .where(eq(schema.leadAppointments.id, appointmentId))

  // Helpers de próxima acción (la cita resuelta ya dejó de estar 'programada',
  // así que crear una nueva no viola el unique parcial uq_one_live_appt_per_lead).
  async function createNextCita(a: NonNullable<typeof nextAction>) {
    await dbAdmin.insert(schema.leadAppointments).values({
      tenant_id:    tenantId,
      lead_id:      leadId,
      vendedor_id:  apptRow.vendedor_id,
      equipo_id:    apptRow.equipo_id,
      scheduled_at: new Date(a.scheduled_at),
      duration_min: a.duration_min ?? 60,
      tipo:         a.tipo!,
      lugar:        a.lugar ?? null,
      notas:        a.notas ?? null,
      created_by:   user.id,
    })
    await appendTimeline(
      tenantId, leadId, user.id,
      'appointment_scheduled',
      'Nueva cita agendada',
      `${APPOINTMENT_TIPO_LABEL[a.tipo!]} · ${fmtApptDateBA(new Date(a.scheduled_at))}`,
    )
  }

  async function scheduleFollowUpCall(whenISO: string, title: string) {
    await cancelPendingCalls(tenantId, leadId, user.id)
    await dbAdmin.insert(schema.leadCalls).values({
      tenant_id:    tenantId,
      lead_id:      leadId,
      created_by:   user.id,
      scheduled_at: new Date(whenISO),
    })
    await appendTimeline(
      tenantId, leadId, user.id,
      'call_scheduled',
      `${title}: ${fmtApptDateBA(new Date(whenISO))}`,
    )
  }

  let openVenta = false
  let openBaja  = false

  if (outcome === 'avanzo') {
    const nextStatus = advanceStatus(leadRow.status, 'CIERRE')
    await q.update(schema.leads).set({
      status:                nextStatus,
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      updated_by:            user.id,
    }).where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    await appendTimeline(tenantId, leadId, user.id, 'appointment_done', 'Entrevista realizada — avanza al cierre', notes?.trim())
    if (nextAction!.kind === 'cita') await createNextCita(nextAction!)
    else await scheduleFollowUpCall(nextAction!.scheduled_at, 'Llamada de seguimiento agendada')

  } else if (outcome === 'otra_reunion') {
    // Se mantiene en ENTREVISTA PACTADA (no avanza a CIERRE): sigue en fase de
    // entrevistas. advanceStatus al estado actual no degrada ni sube.
    await q.update(schema.leads).set({
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      updated_by:            user.id,
    }).where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    await appendTimeline(tenantId, leadId, user.id, 'appointment_done', 'Entrevista realizada — se agenda otra reunión', notes?.trim())
    await createNextCita(nextAction!)

  } else if (outcome === 'no_show') {
    let regressStatus: 'GESTION' | 'HORARIO ASIGNADO' | null = null
    if (leadRow.status === 'ENTREVISTA PACTADA') {
      const hasPendingCall = await dbAdmin
        .select({ id: schema.leadCalls.id })
        .from(schema.leadCalls)
        .where(and(
          eq(schema.leadCalls.lead_id, leadId),
          isNull(schema.leadCalls.realizada_at),
          isNull(schema.leadCalls.canceled_at),
        ))
        .limit(1)
      regressStatus = hasPendingCall[0] ? 'HORARIO ASIGNADO' : 'GESTION'
      await q.update(schema.leads)
        .set({ status: regressStatus, updated_by: user.id })
        .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    }
    await appendTimeline(
      tenantId, leadId, user.id, 'appointment_no_show',
      regressStatus === 'HORARIO ASIGNADO' ? 'No se presentó — vuelve a recoordinar'
        : regressStatus === 'GESTION' ? 'No se presentó — vuelve a gestión activa'
        : 'No se presentó a la cita',
      notes?.trim(),
    )
    if (retryCallAt) await scheduleFollowUpCall(retryCallAt, 'Reintento de contacto agendado')

  } else if (outcome === 'venta') {
    const nextStatus = advanceStatus(leadRow.status, 'CIERRE')
    await q.update(schema.leads).set({
      status:                nextStatus,
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      updated_by:            user.id,
    }).where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    await appendTimeline(tenantId, leadId, user.id, 'appointment_done', 'Entrevista realizada — cierre de venta', notes?.trim())
    openVenta = true

  } else if (outcome === 'no_prospero') {
    // La entrevista se hizo (cuenta como contacto) pero no prosperó; la baja
    // con motivo la registra el diálogo del cliente. No tocamos el estado acá.
    await q.update(schema.leads).set({
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      updated_by:            user.id,
    }).where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    await appendTimeline(tenantId, leadId, user.id, 'appointment_done', 'Entrevista realizada — sin avance', notes?.trim())
    openBaja = true
  }

  void logAudit({
    tenantId, actorId: user.id,
    action: 'appointment.resolve', entity: 'appointment', entityId: appointmentId,
    meta:   { outcome },
    visibleToDueno: true,
  })

  revalidatePath('/citas')
  revalidatePath('/leads')
  revalidatePath('/pipeline')
  revalidatePath('/all-leads')
  revalidatePath('/dashboard')
  return { success: true, data: { outcome, openVenta, openBaja } }
}

// ── getAppointmentsInRange ───────────────────────────────────
// Lista de citas dentro de un rango de fechas, filtrada por scope del usuario.
// Excluye 'cancelada' por default (toggleable con `includeCancelled`).

export async function getAppointmentsInRange(
  from: Date,
  to:   Date,
  filters?: {
    vendedorId?:        string
    tipo?:              string
    status?:            string
    includeCancelled?:  boolean
  },
) {
  const { user, tenantId } = await requireTenant()

  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)
  const scopeWhere = buildAppointmentScopeWhere(scope)

  const where = [
    eq(schema.leadAppointments.tenant_id, tenantId),
    gte(schema.leadAppointments.scheduled_at, from),
    lte(schema.leadAppointments.scheduled_at, to),
  ]
  if (scopeWhere) where.push(scopeWhere)
  if (!filters?.includeCancelled) {
    where.push(ne(schema.leadAppointments.status, 'cancelada'))
  }
  if (filters?.vendedorId) {
    where.push(eq(schema.leadAppointments.vendedor_id, filters.vendedorId))
  }
  if (filters?.tipo) {
    where.push(eq(schema.leadAppointments.tipo, filters.tipo as 'videollamada'))
  }
  if (filters?.status) {
    where.push(eq(schema.leadAppointments.status, filters.status as 'programada'))
  }

  return dbAdmin
    .select({
      id:             schema.leadAppointments.id,
      lead_id:        schema.leadAppointments.lead_id,
      vendedor_id:    schema.leadAppointments.vendedor_id,
      equipo_id:      schema.leadAppointments.equipo_id,
      scheduled_at:   schema.leadAppointments.scheduled_at,
      duration_min:   schema.leadAppointments.duration_min,
      tipo:           schema.leadAppointments.tipo,
      lugar:          schema.leadAppointments.lugar,
      modelo_interes: schema.leadAppointments.modelo_interes,
      notas:          schema.leadAppointments.notas,
      status:         schema.leadAppointments.status,
      outcome_notes:  schema.leadAppointments.outcome_notes,
      // Joins
      lead_nombre:     schema.leads.nombre,
      lead_telefono:   schema.leads.telefono,
      vendedor_nombre: schema.usuarios.nombre,
      vendedor_alias:  schema.usuarios.alias,
    })
    .from(schema.leadAppointments)
    .leftJoin(schema.leads, eq(schema.leadAppointments.lead_id, schema.leads.id))
    .leftJoin(schema.usuarios, eq(schema.leadAppointments.vendedor_id, schema.usuarios.id))
    .where(and(...where))
    .orderBy(schema.leadAppointments.scheduled_at)
}

// ── getNextAppointmentForLead ────────────────────────────────
// La próxima cita programada de un lead. Si no hay → null.

export async function getNextAppointmentForLead(leadId: string) {
  const { tenantId } = await requireTenant()

  const rows = await dbAdmin
    .select()
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.lead_id, leadId),
      eq(schema.leadAppointments.tenant_id, tenantId),
      eq(schema.leadAppointments.status, 'programada'),
    ))
    .orderBy(schema.leadAppointments.scheduled_at)
    .limit(1)

  return rows[0] ?? null
}

// ── getAppointmentsForLead ───────────────────────────────────
// Historial completo de citas de un lead (todas, ordenadas desc).

export async function getAppointmentsForLead(leadId: string) {
  const { tenantId } = await requireTenant()

  return dbAdmin
    .select()
    .from(schema.leadAppointments)
    .where(and(
      eq(schema.leadAppointments.lead_id, leadId),
      eq(schema.leadAppointments.tenant_id, tenantId),
    ))
    .orderBy(sql`scheduled_at DESC`)
}
