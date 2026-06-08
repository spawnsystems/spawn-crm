'use server'

import { revalidatePath } from 'next/cache'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, desc, inArray, or, isNotNull, sql, getTableColumns } from 'drizzle-orm'
import { createLeadSchema, updateLeadSchema, bajaSchema } from '@/lib/schemas/leads'
import { logAudit } from '@/lib/audit/log'
import {
  requireTenant, appendTimeline, getTenantSlaConfig, assertLeadAccess,
  pendingCallAtSql, openApptAtSql, openApptTipoSql, usadoValorSql, usadoRechazadoSql,
} from '@/lib/leads/server-helpers'
import { statusChangeLabel, statusLabel, isBaja, RESCATABLE_STATUSES, BAJA_STATUSES } from '@/lib/leads/constants'
import { serializeHorarios } from '@/lib/leads/horarios'
import { calcularUsado } from '@/lib/cotizador/calc'
import { activeIndex, terminalBlockReason } from '@/lib/leads/state-machine'
import { type SlaConfig } from '@/lib/leads/sla'
import {
  attachAttention, ATTENTION_LABEL, ATTENTION_SEVERITY, ATTENTION_ORDER,
  type AttentionType, type AttentionSeverity,
} from '@/lib/leads/attention'
import type { ActionResult } from './auth'

// ── Helpers ───────────────────────────────────────────────────────

/** Busca el nombre visible de un usuario por su ID. */
async function getVendedorName(userId: string): Promise<string> {
  const row = await dbAdmin
    .select({ nombre: schema.usuarios.nombre, alias: schema.usuarios.alias })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, userId))
    .limit(1)
  return row[0]?.alias || row[0]?.nombre || 'vendedor'
}

// requireTenant + appendTimeline viven en lib/leads/server-helpers.ts
// para poder ser importados desde otros archivos de actions sin que
// queden expuestos como server actions (Next.js trata todo lo exportado
// desde un archivo 'use server' como una action invocable).

// ── createLead ────────────────────────────────────────────────

export async function createLead(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { user, tenantId, q } = await requireTenant()

  const parsed = createLeadSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const data = parsed.data

  // Vendedor siempre se auto-asigna — no puede elegir otro destinatario
  const effectiveAssignedTo = user.rol === 'vendedor' ? user.id : (data.assigned_to ?? null)

  // Buscar equipo_id del asignado
  let equipoId: string | null = null
  if (effectiveAssignedTo) {
    const member = await dbAdmin
      .select({ equipo_id: schema.tenantMembers.equipo_id })
      .from(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenant_id, tenantId),
          eq(schema.tenantMembers.user_id, effectiveAssignedTo),
        ),
      )
      .limit(1)
    equipoId = member[0]?.equipo_id ?? null
  }

  const [row] = await q.insert(schema.leads).values({
    tenant_id:           tenantId,
    nombre:              data.nombre,
    telefono:            data.telefono ?? null,
    email:               data.email    || null,
    modelo:              data.modelo   ?? null,
    source:              data.source,
    source_custom:       data.source_custom ?? null,
    localidad:           data.localidad ?? null,
    provincia:           data.provincia ?? null,
    horario_preferencia: serializeHorarios(data.horarios ?? []),
    tiene_usado:         data.tiene_usado ?? false,
    observaciones:       data.observaciones ?? null,
    est_value:           data.est_value?.toString() ?? null,
    next_action:         data.next_action ?? null,
    assigned_to:         effectiveAssignedTo,
    equipo_id:           equipoId,
    created_by:          user.id,
    updated_by:          user.id,
  }).returning({ id: schema.leads.id })

  // Si se usó "Otro" con texto libre, guardarlo como fuente custom del tenant
  // (upsert seguro: la unique constraint lo ignora si ya existe)
  if (data.source === 'Otro' && data.source_custom?.trim()) {
    await dbAdmin
      .insert(schema.leadSourcesCustom)
      .values({ tenant_id: tenantId, nombre: data.source_custom.trim() })
      .onConflictDoNothing()
  }

  // Si tiene usado y se cargaron los datos, crear la cotización ya asociada al lead.
  if (data.tiene_usado && data.usado) {
    const u = data.usado
    const result = calcularUsado({
      baseInfoauto: u.base_infoauto,
      km:           u.km,
      anio:         u.anio,
      uso:          u.uso,
      provincia:    data.provincia ?? undefined,
    })
    const [cotRow] = await dbAdmin.insert(schema.cotizaciones).values({
      tenant_id:       tenantId,
      lead_id:         row.id,
      marca_modelo:    u.marca_modelo ?? null,
      anio:            u.anio,
      km:              u.km,
      uso:             u.uso,
      base_infoauto:   u.base_infoauto.toString(),
      descuento_pct:   result.descuentoPct.toString(),
      valor_calculado: result.valorCalculado.toString(),
      override_valor:  null,
      valor_final:     result.valorCalculado.toString(),
      rechazado:       result.rechazado,
      rechazo_motivo:  result.rechazoMotivo ?? null,
      condiciones:     result.condiciones,
      created_by:      user.id,
    }).returning({ id: schema.cotizaciones.id })
    await appendTimeline(
      tenantId, row.id, user.id,
      'cotizacion_created',
      result.rechazado ? 'Usado cotizado — rechazado' : 'Usado cotizado',
      result.rechazado
        ? (result.rechazoMotivo ?? undefined)
        : `Valor de toma estimado: $${result.valorCalculado.toLocaleString('es-AR')}`,
    )
    void logAudit({
      tenantId,
      actorId:        user.id,
      action:         'cotizacion.create',
      entity:         'cotizacion',
      entityId:       cotRow.id,
      meta: {
        lead_id:      row.id,
        marca_modelo: u.marca_modelo,
        anio:         u.anio,
        km:           u.km,
        uso:          u.uso,
        valor_final:  result.valorCalculado,
        rechazado:    result.rechazado,
        origen:       'alta_lead',
      },
      visibleToDueno: true,
    })
  }

  const assignedName = effectiveAssignedTo ? await getVendedorName(effectiveAssignedTo) : null
  await appendTimeline(tenantId, row.id, user.id, 'lead_created', 'Lead ingresado al sistema',
    assignedName ? `Asignado a ${assignedName}` : 'Sin asignar — en Bandeja General',
  )

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'lead.create',
    entity:         'lead',
    entityId:       row.id,
    meta:           { nombre: data.nombre, source: data.source, assigned_to: data.assigned_to ?? null },
    visibleToDueno: true,
  })

  revalidatePath('/leads')
  revalidatePath('/dashboard')
  revalidatePath('/all-leads')
  return { success: true, data: { id: row.id } }
}

// ── updateLead ────────────────────────────────────────────────

export async function updateLead(
  leadId: string,
  input:  unknown,
): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const parsed = updateLeadSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const data = parsed.data

  // Si cambia assigned_to, actualizar también el equipo_id
  let equipoId: string | null | undefined = undefined
  if ('assigned_to' in data) {
    if (data.assigned_to) {
      const member = await dbAdmin
        .select({ equipo_id: schema.tenantMembers.equipo_id })
        .from(schema.tenantMembers)
        .where(
          and(
            eq(schema.tenantMembers.tenant_id, tenantId),
            eq(schema.tenantMembers.user_id, data.assigned_to),
          ),
        )
        .limit(1)
      equipoId = member[0]?.equipo_id ?? null
    } else {
      equipoId = null
    }
  }

  await q.update(schema.leads)
    .set({
      ...data,
      est_value:  data.est_value?.toString() ?? undefined,
      ...(equipoId !== undefined ? { equipo_id: equipoId } : {}),
      updated_by: user.id,
    })
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  return { success: true, data: undefined }
}

// ── changeStatus ──────────────────────────────────────────────

export async function changeStatus(
  leadId:    string,
  newStatus: typeof schema.leads.$inferSelect['status'],
): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const current = await dbAdmin
    .select({ status: schema.leads.status })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    .limit(1)

  if (!current[0]) return { success: false, error: 'Lead no encontrado' }

  const from = current[0].status

  // Origen terminal (VENTA o baja): bloqueado. La salida de una baja es por
  // Rescate; de VENTA no hay salida.
  const blocked = terminalBlockReason(from)
  if (blocked) return { success: false, error: blocked }

  // Los estados de baja se setean solo vía darDeBaja (motivo obligatorio).
  if (isBaja(newStatus)) {
    return { success: false, error: 'Usá "Dar de baja" para este estado' }
  }

  // VENTA solo vía "Registrar venta"
  if (newStatus === 'VENTA') {
    return { success: false, error: 'Para registrar una venta usá el botón "Registrar venta"' }
  }

  // No se puede retroceder ni saltar etapas a mano: la etapa avanza con las
  // acciones reales (llamada, cita, cita realizada, venta).
  const fromIdx = activeIndex(from)
  const toIdx   = activeIndex(newStatus)
  if (toIdx <= fromIdx) {
    return { success: false, error: 'La etapa avanza con las acciones del lead, no se cambia a mano.' }
  }

  // CIERRE: se alcanza marcando la cita como realizada.
  if (newStatus === 'CIERRE') {
    return { success: false, error: 'Marcá la cita como realizada para pasar a Cierre' }
  }

  // HORARIO ASIGNADO: requiere al menos una llamada coordinada (agendada o registrada)
  if (newStatus === 'HORARIO ASIGNADO') {
    const call = await dbAdmin
      .select({ id: schema.leadCalls.id })
      .from(schema.leadCalls)
      .where(and(eq(schema.leadCalls.lead_id, leadId), eq(schema.leadCalls.tenant_id, tenantId)))
      .limit(1)
    if (!call[0]) {
      return { success: false, error: 'Agendá o registrá una llamada primero para pasar a Horario Asignado' }
    }
  }

  // ENTREVISTA PACTADA: requiere al menos una cita (el sistema lo hace automáticamente al crear la cita)
  if (newStatus === 'ENTREVISTA PACTADA') {
    const appt = await dbAdmin
      .select({ id: schema.leadAppointments.id })
      .from(schema.leadAppointments)
      .where(and(
        eq(schema.leadAppointments.lead_id, leadId),
        eq(schema.leadAppointments.tenant_id, tenantId),
      ))
      .limit(1)
    if (!appt[0]) {
      return { success: false, error: 'Creá una cita primero — el sistema avanzará a Entrevista Pactada automáticamente' }
    }
  }

  await q.update(schema.leads)
    .set({ status: newStatus, updated_by: user.id })
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))

  await appendTimeline(
    tenantId, leadId, user.id,
    'status_changed',
    statusChangeLabel(current[0].status, newStatus),
  )

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'lead.status_change',
    entity:         'lead',
    entityId:       leadId,
    meta:           { from: current[0].status, to: newStatus },
    visibleToDueno: true,
  })

  revalidatePath('/leads')
  revalidatePath('/pipeline')
  revalidatePath('/all-leads')
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

// ── assignLead ────────────────────────────────────────────────

export async function assignLead(
  leadId:     string,
  vendedorId: string | null,
): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  if (!['dueno','gerente','supervisor'].includes(user.rol)) {
    return { success: false, error: 'Sin permisos para asignar leads' }
  }

  let equipoId: string | null = null
  if (vendedorId) {
    const member = await dbAdmin
      .select({ equipo_id: schema.tenantMembers.equipo_id })
      .from(schema.tenantMembers)
      .where(
        and(
          eq(schema.tenantMembers.tenant_id, tenantId),
          eq(schema.tenantMembers.user_id, vendedorId),
        ),
      )
      .limit(1)
    equipoId = member[0]?.equipo_id ?? null
  }

  await q.update(schema.leads)
    .set({ assigned_to: vendedorId, equipo_id: equipoId, updated_by: user.id })
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))

  const vendedorName = vendedorId ? await getVendedorName(vendedorId) : null
  await appendTimeline(
    tenantId, leadId, user.id,
    'reassigned',
    vendedorName ? `Asignado a ${vendedorName}` : 'Enviado a Bandeja General',
  )

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'lead.assign',
    entity:         'lead',
    entityId:       leadId,
    meta:           { vendedor_id: vendedorId, vendedor_nombre: vendedorName },
    visibleToDueno: true,
  })

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  revalidatePath('/rescate')
  return { success: true, data: undefined }
}

// ── markAsClosed (DEPRECADO) ──────────────────────────────────
// La venta ahora se concreta SOLO vía `registrarVenta` (cotizaciones.ts), que
// exige que el lead esté en CIERRE y deja registro en registro_ventas. Esta
// función se mantiene como stub para no romper imports viejos: no marca venta.
export async function markAsClosed(_leadId: string): Promise<ActionResult<void>> {
  return {
    success: false,
    error:   'Para concretar la venta usá "Registrar venta" desde el cotizador.',
  }
}

// ── darDeBaja ─────────────────────────────────────────────────
// Setea un estado terminal negativo con motivo obligatorio (botón cruz-roja).
// Para estados rescatables marca abandoned_at para que aparezca en Rescate.

export async function darDeBaja(input: unknown): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  const parsed = bajaSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
  const { leadId, status, motivo } = parsed.data

  const rescatable = (RESCATABLE_STATUSES as readonly string[]).includes(status)

  await q.update(schema.leads)
    .set({
      status,
      baja_motivo:  motivo,
      baja_at:      new Date(),
      // los rescatables entran a la bandeja de rescate vía abandoned_at
      ...(rescatable ? { abandoned_at: new Date() } : {}),
      updated_by:   user.id,
    })
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))

  await appendTimeline(
    tenantId, leadId, user.id,
    'lead_baja',
    `Dado de baja: ${statusLabel(status)}`,
    motivo,
  )

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'lead.baja',
    entity:         'lead',
    entityId:       leadId,
    meta:           { status, motivo },
    visibleToDueno: true,
  })

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  revalidatePath('/dashboard')
  revalidatePath('/pipeline')
  revalidatePath('/rescate')
  return { success: true, data: undefined }
}

// ── reactivateFromRescue ──────────────────────────────────────
// Trae un lead de la bandeja de rescate (baja rescatable o inactivo) de vuelta
// al flujo activo ('GESTION'). Limpia abandoned_at + baja, registra
// last_contact_at = now, agrega evento al timeline para mostrar el badge.

export async function reactivateFromRescue(
  leadId: string,
  nota?:  string,
): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  // Solo supervisor+ puede reactivar leads del rescate
  if (!['platform_admin', 'dueno', 'gerente', 'supervisor'].includes(user.rol)) {
    return { success: false, error: 'Solo un supervisor o superior puede reactivar leads del rescate' }
  }

  const current = await dbAdmin
    .select({ status: schema.leads.status, abandoned_at: schema.leads.abandoned_at })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    .limit(1)

  if (!current[0]) return { success: false, error: 'Lead no encontrado' }

  // Rescatable = baja recuperable o inactivo (abandoned_at seteado)
  const enRescate = isBaja(current[0].status)
    ? (RESCATABLE_STATUSES as readonly string[]).includes(current[0].status)
    : current[0].abandoned_at !== null
  if (!enRescate) {
    return { success: false, error: 'El lead no está en rescate' }
  }

  await q.update(schema.leads)
    .set({
      status:                'GESTION',
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      abandoned_at:          null,
      baja_motivo:           null,
      baja_at:               null,
      updated_by:            user.id,
    })
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))

  if (nota?.trim()) {
    await dbAdmin.insert(schema.leadNotes).values({
      tenant_id: tenantId,
      lead_id:   leadId,
      author_id: user.id,
      texto:     nota.trim(),
    })
  }

  // Evento crítico — lo usa el lead-detail-sheet para mostrar el badge
  // "Reactivado del rescate" y el stepper sabe que hubo bifurcación.
  await appendTimeline(
    tenantId, leadId, user.id,
    'reactivated_from_rescue',
    'Reactivado — volvió al seguimiento activo',
    nota?.trim(),
  )

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'lead.reactivated_from_rescue',
    entity:         'lead',
    entityId:       leadId,
    visibleToDueno: true,
  })

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  revalidatePath('/rescate')
  revalidatePath('/dashboard')
  return { success: true, data: undefined }
}

// ── addNote ───────────────────────────────────────────────────

export async function addNote(
  leadId: string,
  texto:  string,
): Promise<ActionResult<{ id: string }>> {
  const { user, tenantId, forTenant } = await requireTenant()

  if (!texto.trim()) return { success: false, error: 'La nota no puede estar vacía' }

  // Verificar que el lead existe y es accesible
  const lead = await dbAdmin
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    .limit(1)
  if (!lead[0]) return { success: false, error: 'Lead no encontrado' }

  const [row] = await dbAdmin.insert(schema.leadNotes).values({
    tenant_id: tenantId,
    lead_id:   leadId,
    author_id: user.id,
    texto:     texto.trim(),
  }).returning({ id: schema.leadNotes.id })

  await appendTimeline(tenantId, leadId, user.id, 'note_added', 'Nota agregada', texto.trim())

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  return { success: true, data: { id: row.id } }
}

// ── deleteNote ────────────────────────────────────────────────
// Hard delete + evento en timeline (queda el rastro del borrado).
// Permiso: el dueño puede borrar cualquier nota del tenant; cualquier
// otro rol solo puede borrar las notas que él mismo escribió.
// Auditado en lead_timeline ('note_deleted') y en audit_logs.
export async function deleteNote(
  noteId: string,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()

  // 1) Cargar la nota y validar tenant
  const note = await dbAdmin
    .select({
      id:        schema.leadNotes.id,
      lead_id:   schema.leadNotes.lead_id,
      author_id: schema.leadNotes.author_id,
      texto:     schema.leadNotes.texto,
      created_at: schema.leadNotes.created_at,
    })
    .from(schema.leadNotes)
    .where(and(eq(schema.leadNotes.id, noteId), eq(schema.leadNotes.tenant_id, tenantId)))
    .limit(1)

  if (!note[0]) return { success: false, error: 'Nota no encontrada' }

  // 2) Verificar permiso: dueño OR autor
  const isOwner  = user.rol === 'dueno'
  const isAuthor = note[0].author_id === user.id
  if (!isOwner && !isAuthor) {
    return { success: false, error: 'No tenés permiso para borrar esta nota' }
  }

  // 3) Verificar acceso al lead (defensa en profundidad: que el lead sea visible al usuario)
  const accessible = await assertLeadAccess(note[0].lead_id, user.id, user.rol, tenantId)
  if (!accessible) return { success: false, error: 'No tenés acceso a este lead' }

  // 4) Hard delete
  await dbAdmin
    .delete(schema.leadNotes)
    .where(eq(schema.leadNotes.id, noteId))

  // 5) Auditoría: queda el texto original en el timeline para no perder trazabilidad
  const previewText = note[0].texto.length > 200
    ? note[0].texto.slice(0, 200) + '…'
    : note[0].texto
  await appendTimeline(
    tenantId, note[0].lead_id, user.id,
    'note_deleted',
    'Nota borrada',
    previewText,
  )

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'lead.note_deleted',
    entity:         'lead_note',
    entityId:       noteId,
    meta:           {
      lead_id:    note[0].lead_id,
      author_id:  note[0].author_id,
      texto:      note[0].texto,
      created_at: note[0].created_at,
    },
    visibleToDueno: true,
  })

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  return { success: true, data: undefined }
}

// ── addTask ───────────────────────────────────────────────────

export async function addTask(
  leadId: string,
  texto:  string,
  dueAt?: Date,
): Promise<ActionResult<{ id: string }>> {
  const { user, tenantId, forTenant } = await requireTenant()

  if (!texto.trim()) return { success: false, error: 'La tarea no puede estar vacía' }

  const lead = await dbAdmin
    .select({ id: schema.leads.id, assigned_to: schema.leads.assigned_to })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    .limit(1)
  if (!lead[0]) return { success: false, error: 'Lead no encontrado' }

  const [row] = await dbAdmin.insert(schema.leadTasks).values({
    tenant_id:   tenantId,
    lead_id:     leadId,
    assigned_to: lead[0].assigned_to ?? user.id,
    texto:       texto.trim(),
    due_at:      dueAt ?? null,
    done:        false,
  }).returning({ id: schema.leadTasks.id })

  revalidatePath('/leads')
  return { success: true, data: { id: row.id } }
}

// ── toggleTask ────────────────────────────────────────────────

export async function toggleTask(
  taskId: string,
  done:   boolean,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()

  await dbAdmin
    .update(schema.leadTasks)
    .set({ done })
    .where(
      and(
        eq(schema.leadTasks.id, taskId),
        eq(schema.leadTasks.tenant_id, tenantId),
      ),
    )

  if (done) {
    const task = await dbAdmin
      .select({ lead_id: schema.leadTasks.lead_id, texto: schema.leadTasks.texto })
      .from(schema.leadTasks)
      .where(eq(schema.leadTasks.id, taskId))
      .limit(1)
    if (task[0]) {
      await appendTimeline(tenantId, task[0].lead_id, user.id, 'task_done',
        'Tarea completada', task[0].texto)
    }
  }

  revalidatePath('/leads')
  return { success: true, data: undefined }
}

// ── getMyLeads ────────────────────────────────────────────────
// Leads del usuario actual (vendedor o supervisor mirando sus leads)

export async function getMyLeads() {
  const { user, tenantId } = await requireTenant()

  const [rows, sla] = await Promise.all([
    dbAdmin
      .select({
        ...getTableColumns(schema.leads),
        pending_call_at: pendingCallAtSql,
        open_appt_at:    openApptAtSql,
        open_appt_tipo:  openApptTipoSql,
        usado_valor:     usadoValorSql,
        usado_rechazado: usadoRechazadoSql,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenant_id, tenantId),
          eq(schema.leads.assigned_to, user.id),
        ),
      )
      .orderBy(desc(schema.leads.created_at)),
    getTenantSlaConfig(tenantId),
  ])

  return rows.map((l) => deriveAttention(l, sla))
}

// Adjunta el estado de atención derivado (sin trigger). Reemplaza al viejo
// at_risk binario: ahora at_risk = "requiere atención" + el motivo concreto.
type AttentionRow = {
  status: string
  created_at: Date | string
  last_contact_at: Date | string | null
  stage_entered_at: Date | string | null
  pending_call_at: Date | string | null
  open_appt_at: Date | string | null
}

function deriveAttention<T extends AttentionRow>(lead: T, sla: SlaConfig) {
  return attachAttention(lead, sla)
}

// ── getMyTeamIds ──────────────────────────────────────────────
// Retorna los IDs de equipo que el usuario puede ver según su rol.
// Supervisor → equipos donde supervisor_id = user.id
// Gerente    → equipos donde gerente_id    = user.id
// null       → no tiene equipos asignados

async function getMyTeamIds(
  userId: string,
  tenantId: string,
  rol: string,
): Promise<string[] | null> {
  if (['platform_admin', 'dueno'].includes(rol)) return null // ve todo

  const field = rol === 'gerente'
    ? schema.equipos.gerente_id
    : schema.equipos.supervisor_id

  const rows = await dbAdmin
    .select({ id: schema.equipos.id })
    .from(schema.equipos)
    .where(
      and(
        eq(schema.equipos.tenant_id, tenantId),
        eq(field, userId),
        eq(schema.equipos.activo, true),
      ),
    )

  return rows.map((r) => r.id)
}

// ── getAllLeads ───────────────────────────────────────────────
// Leads visibles para el usuario según su rol y equipos:
//   dueño/admin → todos los del tenant
//   gerente     → solo leads de equipos que dirige
//   supervisor  → solo leads de equipos que supervisa
//   vendedor    → solo los asignados a él

export async function getAllLeads() {
  const { user, tenantId } = await requireTenant()

  const LEAD_FIELDS = {
    id:                    schema.leads.id,
    tenant_id:             schema.leads.tenant_id,
    nombre:                schema.leads.nombre,
    telefono:              schema.leads.telefono,
    email:                 schema.leads.email,
    modelo:                schema.leads.modelo,
    source:                schema.leads.source,
    source_custom:         schema.leads.source_custom,
    localidad:             schema.leads.localidad,
    provincia:             schema.leads.provincia,
    horario_preferencia:   schema.leads.horario_preferencia,
    tiene_usado:           schema.leads.tiene_usado,
    observaciones:         schema.leads.observaciones,
    status:                schema.leads.status,
    next_action:           schema.leads.next_action,
    est_value:             schema.leads.est_value,
    days_in_stage:         schema.leads.days_in_stage,
    at_risk:               schema.leads.at_risk,
    last_contact_at:       schema.leads.last_contact_at,
    last_contact_critical: schema.leads.last_contact_critical,
    stage_entered_at:      schema.leads.stage_entered_at,
    abandoned_at:          schema.leads.abandoned_at,
    rescue_category:       schema.leads.rescue_category,
    baja_motivo:           schema.leads.baja_motivo,
    baja_at:               schema.leads.baja_at,
    assigned_to:           schema.leads.assigned_to,
    equipo_id:             schema.leads.equipo_id,
    created_by:            schema.leads.created_by,
    updated_by:            schema.leads.updated_by,
    created_at:            schema.leads.created_at,
    updated_at:            schema.leads.updated_at,
    vendedor_nombre:       schema.usuarios.nombre,
    vendedor_alias:        schema.usuarios.alias,
    pending_call_at:       pendingCallAtSql,
    open_appt_at:          openApptAtSql,
  }

  const base = dbAdmin
    .select(LEAD_FIELDS)
    .from(schema.leads)
    .leftJoin(schema.usuarios, eq(schema.leads.assigned_to, schema.usuarios.id))

  const sla = await getTenantSlaConfig(tenantId)

  // Dueño / platform_admin → sin filtro adicional
  if (['platform_admin', 'dueno'].includes(user.rol)) {
    const rows = await base
      .where(eq(schema.leads.tenant_id, tenantId))
      .orderBy(desc(schema.leads.created_at))
    return rows.map((l) => deriveAttention(l, sla))
  }

  // Vendedor → solo sus leads
  if (user.rol === 'vendedor') {
    const rows = await base
      .where(and(
        eq(schema.leads.tenant_id, tenantId),
        eq(schema.leads.assigned_to, user.id),
      ))
      .orderBy(desc(schema.leads.created_at))
    return rows.map((l) => deriveAttention(l, sla))
  }

  // Gerente / Supervisor → filtrar por equipos a cargo
  const teamIds = await getMyTeamIds(user.id, tenantId, user.rol)

  // Sin equipos asignados → no ve nada
  if (!teamIds || teamIds.length === 0) return []

  const rows = await base
    .where(and(
      eq(schema.leads.tenant_id, tenantId),
      inArray(schema.leads.equipo_id, teamIds),
    ))
    .orderBy(desc(schema.leads.created_at))
  return rows.map((l) => deriveAttention(l, sla))
}

// ── getAttentionSummary ───────────────────────────────────────
// Resumen de leads que requieren atención, scopeado por rol (reusa getAllLeads).
// Para el panel del dashboard de supervisores/gerentes/dueño.

export interface AttentionSummary {
  total:    number
  byType:   { type: AttentionType; label: string; severity: AttentionSeverity; count: number }[]
  bySeller: { name: string; count: number; alta: number }[]
}

export async function getAttentionSummary(): Promise<AttentionSummary> {
  const leads = await getAllLeads()
  const flagged = leads.filter((l) => l.at_risk && l.attention_type)

  // Conteo por tipo
  const typeCount = new Map<AttentionType, number>()
  for (const l of flagged) {
    const t = l.attention_type as AttentionType
    typeCount.set(t, (typeCount.get(t) ?? 0) + 1)
  }
  const byType = ATTENTION_ORDER
    .filter((t) => (typeCount.get(t) ?? 0) > 0)
    .map((t) => ({
      type: t, label: ATTENTION_LABEL[t], severity: ATTENTION_SEVERITY[t],
      count: typeCount.get(t) ?? 0,
    }))

  // Conteo por vendedor (incluye cuántos son de severidad alta)
  const sellerMap = new Map<string, { count: number; alta: number }>()
  for (const l of flagged) {
    const name = l.vendedor_alias || l.vendedor_nombre || 'Sin asignar'
    const cur = sellerMap.get(name) ?? { count: 0, alta: 0 }
    cur.count += 1
    if (l.attention_severity === 'alta') cur.alta += 1
    sellerMap.set(name, cur)
  }
  const bySeller = Array.from(sellerMap.entries())
    .map(([name, v]) => ({ name, count: v.count, alta: v.alta }))
    .sort((a, b) => b.count - a.count)

  return { total: flagged.length, byType, bySeller }
}

// ── getAbandonedLeads ─────────────────────────────────────────
// Bandeja de rescate: leads dados de baja recuperables (RESCATABLE_STATUSES)
// o inactivos (abandoned_at no nulo). Mismo scoping que getAllLeads.

export async function getAbandonedLeads() {
  const { user, tenantId } = await requireTenant()

  // Predicado derivado: baja rescatable OR inactivo
  const rescatePredicate = or(
    inArray(schema.leads.status, [...RESCATABLE_STATUSES]),
    isNotNull(schema.leads.abandoned_at),
  )
  // Orden: por la fecha más reciente entre baja_at y abandoned_at
  const rescateOrder = desc(sql`COALESCE(${schema.leads.baja_at}, ${schema.leads.abandoned_at})`)

  const base = dbAdmin
    .select({
      id:              schema.leads.id,
      nombre:          schema.leads.nombre,
      modelo:          schema.leads.modelo,
      status:          schema.leads.status,
      est_value:       schema.leads.est_value,
      abandoned_at:    schema.leads.abandoned_at,
      baja_at:         schema.leads.baja_at,
      baja_motivo:     schema.leads.baja_motivo,
      assigned_to:     schema.leads.assigned_to,
      equipo_id:       schema.leads.equipo_id,
      vendedor_nombre: schema.usuarios.nombre,
      vendedor_alias:  schema.usuarios.alias,
    })
    .from(schema.leads)
    .leftJoin(schema.usuarios, eq(schema.leads.assigned_to, schema.usuarios.id))

  if (['platform_admin', 'dueno'].includes(user.rol)) {
    return base
      .where(and(
        eq(schema.leads.tenant_id, tenantId),
        rescatePredicate,
      ))
      .orderBy(rescateOrder)
  }

  const teamIds = await getMyTeamIds(user.id, tenantId, user.rol)
  if (!teamIds || teamIds.length === 0) return []

  return base
    .where(and(
      eq(schema.leads.tenant_id, tenantId),
      rescatePredicate,
      inArray(schema.leads.equipo_id, teamIds),
    ))
    .orderBy(rescateOrder)
}

// ── getHistorialLeads ─────────────────────────────────────────
// Leads cerrados (VENTA) y dados de baja. Scoping idéntico a getAllLeads.
// Accesible a todos los roles; vendedor solo ve los suyos.

export async function getHistorialLeads() {
  const { user, tenantId } = await requireTenant()

  const historialPredicate = or(
    eq(schema.leads.status, 'VENTA'),
    inArray(schema.leads.status, [...BAJA_STATUSES]),
  )

  const FIELDS = {
    id:              schema.leads.id,
    nombre:          schema.leads.nombre,
    telefono:        schema.leads.telefono,
    modelo:          schema.leads.modelo,
    source:          schema.leads.source,
    status:          schema.leads.status,
    baja_motivo:     schema.leads.baja_motivo,
    baja_at:         schema.leads.baja_at,
    est_value:       schema.leads.est_value,
    assigned_to:     schema.leads.assigned_to,
    equipo_id:       schema.leads.equipo_id,
    created_by:      schema.leads.created_by,
    created_at:      schema.leads.created_at,
    updated_at:      schema.leads.updated_at,
    vendedor_nombre: schema.usuarios.nombre,
    vendedor_alias:  schema.usuarios.alias,
  }

  const base = dbAdmin
    .select(FIELDS)
    .from(schema.leads)
    .leftJoin(schema.usuarios, eq(schema.leads.assigned_to, schema.usuarios.id))

  const orderBy = desc(sql`COALESCE(${schema.leads.baja_at}, ${schema.leads.updated_at})`)

  // Dueño / admin → todo el tenant
  if (['platform_admin', 'dueno'].includes(user.rol)) {
    return base
      .where(and(eq(schema.leads.tenant_id, tenantId), historialPredicate))
      .orderBy(orderBy)
  }

  // Vendedor → solo sus leads
  if (user.rol === 'vendedor') {
    return base
      .where(and(
        eq(schema.leads.tenant_id, tenantId),
        eq(schema.leads.assigned_to, user.id),
        historialPredicate,
      ))
      .orderBy(orderBy)
  }

  // Gerente / Supervisor → por equipos a cargo
  const teamIds = await getMyTeamIds(user.id, tenantId, user.rol)
  if (!teamIds || teamIds.length === 0) return []

  return base
    .where(and(
      eq(schema.leads.tenant_id, tenantId),
      inArray(schema.leads.equipo_id, teamIds),
      historialPredicate,
    ))
    .orderBy(orderBy)
}

// ── getLeadDetail ─────────────────────────────────────────────

export async function getLeadDetail(leadId: string) {
  const { user, tenantId, forTenant } = await requireTenant()

  // Scope: el usuario debe poder ver este lead según su rol/equipo (no solo tenant)
  const accessible = await assertLeadAccess(leadId, user.id, user.rol, tenantId)
  if (!accessible) return null

  const [lead, notes, timeline, tasks, calls, appts, cotizaciones] = await Promise.all([
    dbAdmin
      .select()
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
      .limit(1),

    dbAdmin
      .select({
        id:        schema.leadNotes.id,
        texto:     schema.leadNotes.texto,
        created_at: schema.leadNotes.created_at,
        autor:     schema.usuarios.nombre,
        author_id: schema.leadNotes.author_id,
      })
      .from(schema.leadNotes)
      .leftJoin(schema.usuarios, eq(schema.leadNotes.author_id, schema.usuarios.id))
      .where(
        and(
          eq(schema.leadNotes.lead_id, leadId),
          eq(schema.leadNotes.tenant_id, tenantId),
        ),
      )
      .orderBy(desc(schema.leadNotes.created_at)),

    dbAdmin
      .select()
      .from(schema.leadTimeline)
      .where(
        and(
          eq(schema.leadTimeline.lead_id, leadId),
          eq(schema.leadTimeline.tenant_id, tenantId),
        ),
      )
      .orderBy(desc(schema.leadTimeline.created_at)),

    dbAdmin
      .select()
      .from(schema.leadTasks)
      .where(
        and(
          eq(schema.leadTasks.lead_id, leadId),
          eq(schema.leadTasks.tenant_id, tenantId),
        ),
      )
      .orderBy(schema.leadTasks.done, desc(schema.leadTasks.created_at)),

    dbAdmin
      .select()
      .from(schema.leadCalls)
      .where(
        and(
          eq(schema.leadCalls.lead_id, leadId),
          eq(schema.leadCalls.tenant_id, tenantId),
        ),
      )
      .orderBy(desc(schema.leadCalls.scheduled_at)),

    // ¿Existe al menos una cita (para habilitar avance a ENTREVISTA PACTADA)?
    dbAdmin
      .select({ id: schema.leadAppointments.id })
      .from(schema.leadAppointments)
      .where(and(
        eq(schema.leadAppointments.lead_id, leadId),
        eq(schema.leadAppointments.tenant_id, tenantId),
      ))
      .limit(1),

    // Cotizaciones del usado asociadas al lead (más reciente primero)
    dbAdmin
      .select()
      .from(schema.cotizaciones)
      .where(and(
        eq(schema.cotizaciones.lead_id, leadId),
        eq(schema.cotizaciones.tenant_id, tenantId),
      ))
      .orderBy(desc(schema.cotizaciones.created_at)),
  ])

  if (!lead[0]) return null

  // Nombre del creador del lead (join separado para evitar alias en la misma tabla)
  const creatorRow = lead[0].created_by
    ? await dbAdmin
        .select({ nombre: schema.usuarios.nombre, alias: schema.usuarios.alias })
        .from(schema.usuarios)
        .where(eq(schema.usuarios.id, lead[0].created_by))
        .limit(1)
    : []

  const creator_nombre = creatorRow[0]?.alias || creatorRow[0]?.nombre || null

  return { lead: { ...lead[0], creator_nombre }, notes, timeline, tasks, calls, cotizaciones, anyAppointment: appts.length > 0 }
}
