'use server'

import { revalidatePath } from 'next/cache'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, desc, inArray, or, isNotNull, sql } from 'drizzle-orm'
import { createLeadSchema, updateLeadSchema, bajaSchema } from '@/lib/schemas/leads'
import { logAudit } from '@/lib/audit/log'
import { requireTenant, appendTimeline, getTenantSlaConfig, assertLeadAccess } from '@/lib/leads/server-helpers'
import { statusChangeLabel, statusLabel, isBaja, RESCATABLE_STATUSES, BAJA_STATUSES } from '@/lib/leads/constants'
import { computeSla, type SlaConfig } from '@/lib/leads/sla'
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
    horario_preferencia: data.horario_preferencia ?? null,
    tiene_usado:         data.tiene_usado ?? false,
    observaciones:       data.observaciones ?? null,
    est_value:           data.est_value?.toString() ?? null,
    next_action:         data.next_action ?? null,
    assigned_to:         effectiveAssignedTo,
    equipo_id:           equipoId,
    created_by:          user.id,
    updated_by:          user.id,
  }).returning({ id: schema.leads.id })

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

  // Los estados de baja se setean solo vía darDeBaja (motivo obligatorio).
  if (isBaja(newStatus)) {
    return { success: false, error: 'Usá "Dar de baja" para este estado' }
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

// ── markAsClosed ──────────────────────────────────────────────
// Marca el lead como VENTA (terminal positivo).

export async function markAsClosed(leadId: string): Promise<ActionResult<void>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  await q.update(schema.leads)
    .set({ status: 'VENTA', abandoned_at: null, updated_by: user.id })
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))

  await appendTimeline(tenantId, leadId, user.id, 'closed_won', '¡Venta concretada! Trato confirmado')

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'lead.closed_won',
    entity:         'lead',
    entityId:       leadId,
    visibleToDueno: true,
  })

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  revalidatePath('/dashboard')
  revalidatePath('/pipeline')
  return { success: true, data: undefined }
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

// ── markContacted ─────────────────────────────────────────────
// Registra un contacto — resetea at_risk y last_contact_at.
// El lead permanece en GESTIÓN (estado de trabajo); el avance de etapa
// se hace explícitamente. "advanced" indica si es el primer contacto.

export async function markContacted(
  leadId: string,
  nota?:  string,
): Promise<ActionResult<{ advanced: boolean }>> {
  const { user, tenantId, q, forTenant } = await requireTenant()

  // Leer last_contact_at para distinguir el primer contacto
  const current = await dbAdmin
    .select({ last_contact_at: schema.leads.last_contact_at })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))
    .limit(1)

  if (!current[0]) return { success: false, error: 'Lead no encontrado' }

  const advanced = current[0].last_contact_at === null

  await q.update(schema.leads)
    .set({
      last_contact_at:       new Date(),
      last_contact_critical: false,
      at_risk:               false,
      updated_by:            user.id,
    })
    .where(and(eq(schema.leads.id, leadId), forTenant(schema.leads)))

  const contactedTitle = advanced ? 'Primer contacto registrado' : 'Contacto registrado'
  if (nota?.trim()) {
    await dbAdmin.insert(schema.leadNotes).values({
      tenant_id: tenantId,
      lead_id:   leadId,
      author_id: user.id,
      texto:     nota.trim(),
    })
    await appendTimeline(tenantId, leadId, user.id, 'contacted', contactedTitle, nota.trim())
  } else {
    await appendTimeline(tenantId, leadId, user.id, 'contacted', contactedTitle)
  }

  void logAudit({
    tenantId,
    actorId:  user.id,
    action:   'lead.contacted',
    entity:   'lead',
    entityId: leadId,
  })

  revalidatePath('/leads')
  revalidatePath('/all-leads')
  return { success: true, data: { advanced } }
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
      .select()
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

  return rows.map((l) => deriveRisk(l, sla))
}

// Sobreescribe at_risk con el cálculo de SLA derivado (sin trigger).
function deriveRisk<T extends { at_risk: boolean; created_at: Date; last_contact_at: Date | null; status: string }>(
  lead: T,
  sla:  SlaConfig,
): T {
  return { ...lead, at_risk: computeSla(lead, sla).demorado }
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
    return rows.map((l) => deriveRisk(l, sla))
  }

  // Vendedor → solo sus leads
  if (user.rol === 'vendedor') {
    const rows = await base
      .where(and(
        eq(schema.leads.tenant_id, tenantId),
        eq(schema.leads.assigned_to, user.id),
      ))
      .orderBy(desc(schema.leads.created_at))
    return rows.map((l) => deriveRisk(l, sla))
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
  return rows.map((l) => deriveRisk(l, sla))
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

  const [lead, notes, timeline, tasks, calls] = await Promise.all([
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

  return { lead: { ...lead[0], creator_nombre }, notes, timeline, tasks, calls }
}
