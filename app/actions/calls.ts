'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, and, desc, isNotNull } from 'drizzle-orm'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { dbAdmin, schema } from '@/lib/db'
import { requireTenant, appendTimeline, assertLeadAccess } from '@/lib/leads/server-helpers'
import { advanceStatus, isTerminal, terminalBlockReason } from '@/lib/leads/state-machine'
import { isBaja } from '@/lib/leads/constants'
import { appointmentTipoValues, APPOINTMENT_TIPO_LABEL } from '@/lib/schemas/appointments'
import { logAudit } from '@/lib/audit/log'
import type { ActionResult } from './auth'

const BA_TZ = 'America/Argentina/Buenos_Aires'

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

// ── Schemas ───────────────────────────────────────────────────────────────────

const scheduleCallSchema = z.object({
  leadId:       z.string().uuid(),
  scheduledAt:  z.string().datetime({ offset: true }),
  notasPrevias: z.string().max(500).optional(),
})

const registerCallSchema = z.object({
  // Una llamada se registra de dos formas, mutuamente excluyentes:
  //  - callId: registrar una llamada YA agendada (leadCall pendiente).
  //  - leadId: llamada ad-hoc (no se había agendado) → se crea y registra
  //            en un solo paso. Así toda llamada pasa por el mismo flujo
  //            con resultado obligatorio y deriva en una acción siguiente.
  callId:           z.string().uuid().optional(),
  leadId:           z.string().uuid().optional(),
  // Resultados posibles de una llamada:
  //  - no_contesto:     no atendió. No es baja; registra el intento.
  //  - sin_avance:      atendió pero sin paso concreto. Sigue en gestión.
  //  - proxima_llamada: quedaron en otra llamada con fecha. → HORARIO ASIGNADO.
  //  - cita:            se pactó una cita. → ENTREVISTA PACTADA.
  //  - descartado:      cierre negativo genuino → abre baja con motivo.
  outcome:          z.enum(['no_contesto', 'sin_avance', 'proxima_llamada', 'cita', 'descartado']),
  notasResultado:   z.string().max(1000).optional(),
  // Fecha de la próxima llamada. Obligatoria para proxima_llamada; opcional para
  // no_contesto (reintento que el vendedor planifica).
  proximaLlamadaAt: z.string().datetime({ offset: true }).optional(),

  // Si outcome=cita, estos campos son OBLIGATORIOS (validado abajo).
  // Crea la cita atómicamente en el mismo flujo para que el lead no quede
  // "en limbo" con outcome=cita pero sin cita real agendada.
  appointment: z.object({
    scheduled_at: z.string().datetime({ offset: true }),
    tipo:         z.enum(appointmentTipoValues),
    duration_min: z.number().int().min(15).max(240).default(60),
    lugar:        z.string().max(200).optional(),
    notas:        z.string().max(2000).optional(),
  }).optional(),
}).superRefine((val, ctx) => {
  if (!val.callId && !val.leadId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['callId'],
      message: 'Falta la llamada o el lead a registrar.',
    })
  }
  if (val.outcome === 'cita' && !val.appointment) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointment'],
      message: 'Si la llamada terminó en cita, hay que agendarla ahora.',
    })
  }
  if (val.outcome === 'proxima_llamada' && !val.proximaLlamadaAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['proximaLlamadaAt'],
      message: 'Indicá la fecha de la próxima llamada.',
    })
  }
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
): Promise<ActionResult<{ outcome: string; unansweredStreak: number }>> {
  const { user, tenantId } = await requireTenant()

  const parsed = registerCallSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { callId, leadId: adHocLeadId, outcome, notasResultado, proximaLlamadaAt, appointment } = parsed.data

  // 1) Resolver el lead — desde la llamada agendada (callId) o directo (ad-hoc).
  let leadId: string
  if (callId) {
    const call = await dbAdmin
      .select()
      .from(schema.leadCalls)
      .where(and(eq(schema.leadCalls.id, callId), eq(schema.leadCalls.tenant_id, tenantId)))
      .limit(1)
    if (!call[0]) return { success: false, error: 'Llamada no encontrada' }
    if (call[0].realizada_at) return { success: false, error: 'Esta llamada ya fue registrada' }
    leadId = call[0].lead_id
  } else {
    leadId = adHocLeadId!
  }

  // 2) Scope: el usuario debe tener acceso al lead (no solo al tenant)
  const lead = await assertLeadAccess(leadId, user.id, user.rol, tenantId)
  if (!lead) return { success: false, error: 'No tenés acceso a este lead' }

  // Llamada ad-hoc: no se puede registrar sobre un lead cerrado / dado de baja
  // (salvo outcome=cita, que reactiva de rescate más abajo).
  if (!callId && isTerminal(lead.status) && outcome !== 'cita') {
    return { success: false, error: terminalBlockReason(lead.status) ?? 'El lead no admite cambios' }
  }

  // 3) Pre-check para outcome=cita: validar la fecha y que no haya otra cita programada
  //    ANTES de tocar la llamada (para no dejarla "registrada sin cita" si esto falla).
  let apptScheduledAt: Date | null = null
  if (outcome === 'cita' && appointment) {
    apptScheduledAt = new Date(appointment.scheduled_at)
    if (apptScheduledAt.getTime() <= Date.now()) {
      return { success: false, error: 'La cita debe ser en el futuro' }
    }
    const existing = await dbAdmin
      .select({ id: schema.leadAppointments.id })
      .from(schema.leadAppointments)
      .where(and(
        eq(schema.leadAppointments.lead_id, leadId),
        eq(schema.leadAppointments.status, 'programada'),
      ))
      .limit(1)
    if (existing[0]) {
      return {
        success: false,
        error:   'Ya hay una cita programada para este lead. Cancelala o reagendala primero.',
      }
    }
  }

  // 4) Resolver equipo del vendedor para denormalizar en la cita (si aplica)
  const vendedorId = lead.assigned_to ?? user.id
  let equipoId: string | null = null
  if (outcome === 'cita') {
    const member = await dbAdmin
      .select({ equipo_id: schema.tenantMembers.equipo_id })
      .from(schema.tenantMembers)
      .where(and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.user_id, vendedorId),
      ))
      .limit(1)
    equipoId = member[0]?.equipo_id ?? lead.equipo_id ?? null
  }

  // 5) Registrar la llamada: actualizar la agendada o crear una ya realizada (ad-hoc)
  if (callId) {
    await dbAdmin
      .update(schema.leadCalls)
      .set({
        realizada_at:   new Date(),
        outcome,
        notas_resultado: notasResultado ?? null,
      })
      .where(eq(schema.leadCalls.id, callId))
  } else {
    await dbAdmin.insert(schema.leadCalls).values({
      tenant_id:       tenantId,
      lead_id:         leadId,
      created_by:      user.id,
      scheduled_at:    new Date(),   // llamada espontánea: agendada = realizada = ahora
      realizada_at:    new Date(),
      outcome,
      notas_resultado: notasResultado ?? null,
    })
  }

  const outcomeLabel: Record<string, string> = {
    no_contesto:     'No contestó',
    sin_avance:      'Atendió — sin avance',
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

  // Helper: crea una llamada agendada (pendiente) + evento en el historial.
  async function scheduleNextCall(whenISO: string, titlePrefix: string) {
    await dbAdmin.insert(schema.leadCalls).values({
      tenant_id:    tenantId,
      lead_id:      leadId,
      created_by:   user.id,
      scheduled_at: new Date(whenISO),
    })
    const fechaLabel = format(new Date(whenISO), "d 'de' MMM 'a las' HH:mm", { locale: es })
    await appendTimeline(
      tenantId, leadId, user.id,
      'call_scheduled',
      `${titlePrefix}: ${fechaLabel}`,
    )
  }

  // 6) Side-effect según outcome
  let unansweredStreak = 0

  if (outcome === 'cita' && appointment && apptScheduledAt) {
    // 6a) Crear la cita atómicamente — mismo flujo que createAppointment.
    const [apptRow] = await dbAdmin.insert(schema.leadAppointments).values({
      tenant_id:      tenantId,
      lead_id:        leadId,
      vendedor_id:    vendedorId,
      equipo_id:      equipoId,
      scheduled_at:   apptScheduledAt,
      duration_min:   appointment.duration_min,
      tipo:           appointment.tipo,
      lugar:          appointment.lugar ?? null,
      modelo_interes: null,
      notas:          appointment.notas ?? null,
      created_by:     user.id,
    }).returning({ id: schema.leadAppointments.id })

    // Avanzar a ENTREVISTA PACTADA si todavía no llegó.
    // Si venía de baja/rescate, reactivarlo.
    const cameFromRescue = isBaja(lead.status) || lead.abandoned_at !== null
    const yaAvanzado     = ['ENTREVISTA PACTADA', 'CIERRE', 'VENTA'].includes(lead.status)

    await dbAdmin.update(schema.leads).set({
      status:                yaAvanzado ? lead.status : 'ENTREVISTA PACTADA',
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      ...(cameFromRescue ? { abandoned_at: null, baja_motivo: null, baja_at: null } : {}),
      updated_by:            user.id,
    }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenant_id, tenantId)))

    if (cameFromRescue) {
      await appendTimeline(
        tenantId, leadId, user.id,
        'reactivated_from_rescue',
        'Reactivado — volvió al seguimiento activo',
      )
    }

    await appendTimeline(
      tenantId, leadId, user.id,
      'appointment_scheduled',
      'Cita pautada con el cliente',
      `${APPOINTMENT_TIPO_LABEL[appointment.tipo]} · ${fmtApptDateBA(apptScheduledAt)}`,
    )

    void logAudit({
      tenantId,
      actorId:        user.id,
      action:         'appointment.create',
      entity:         'appointment',
      entityId:       apptRow.id,
      meta: {
        lead_id:      leadId,
        scheduled_at: apptScheduledAt,
        tipo:         appointment.tipo,
        via:          'register_call',
      },
      visibleToDueno: true,
    })

  } else if (outcome === 'proxima_llamada' && proximaLlamadaAt) {
    // 6b) Quedaron en otra llamada con fecha concreta → crear la llamada
    //     agendada, avanzar a HORARIO ASIGNADO y refrescar el reloj (hubo contacto).
    await scheduleNextCall(proximaLlamadaAt, 'Próxima llamada agendada')
    const nextStatus = advanceStatus(lead.status, 'HORARIO ASIGNADO')
    await dbAdmin.update(schema.leads).set({
      status:                nextStatus,
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      updated_by:            user.id,
    }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenant_id, tenantId)))

  } else if (outcome === 'sin_avance') {
    // 6c) Atendió pero sin paso concreto. Cuenta como contacto efectivo
    //     (refresca el reloj). Si tenía una llamada coordinada (HORARIO
    //     ASIGNADO) y no se avanzó, vuelve a GESTIÓN. No degradamos etapas
    //     posteriores (ENTREVISTA PACTADA / CIERRE).
    const backToGestion = lead.status === 'HORARIO ASIGNADO'
    await dbAdmin.update(schema.leads).set({
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      ...(backToGestion ? { status: 'GESTION' as const } : {}),
      updated_by:            user.id,
    }).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenant_id, tenantId)))

  } else if (outcome === 'no_contesto') {
    // 6d) No atendió. NO es contacto efectivo: NO refrescamos last_contact_at,
    //     así el reloj de "Demorado" sigue corriendo (es la señal real de que
    //     no se lo puede alcanzar). Reintento opcional planificado por el
    //     vendedor (no avanza la etapa). Calculamos la racha de intentos sin
    //     respuesta para que la UI sugiera dar de baja tras varios.
    if (proximaLlamadaAt) {
      await scheduleNextCall(proximaLlamadaAt, 'Reintento de llamada agendado')
    }
    const recent = await dbAdmin
      .select({ outcome: schema.leadCalls.outcome })
      .from(schema.leadCalls)
      .where(and(
        eq(schema.leadCalls.lead_id, leadId),
        eq(schema.leadCalls.tenant_id, tenantId),
        isNotNull(schema.leadCalls.realizada_at),
      ))
      .orderBy(desc(schema.leadCalls.realizada_at))
      .limit(10)
    for (const r of recent) {
      if (r.outcome === 'no_contesto') unansweredStreak++
      else break
    }
  }
  // descartado: no toca el lead acá. La baja se hace en el diálogo aparte
  // (la UI lo abre al recibir outcome='descartado').

  revalidatePath('/leads')
  revalidatePath('/pipeline')
  revalidatePath('/all-leads')
  revalidatePath('/citas')
  return { success: true, data: { outcome, unansweredStreak } }
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
