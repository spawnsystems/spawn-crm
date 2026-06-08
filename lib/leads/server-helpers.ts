/**
 * lib/leads/server-helpers.ts
 *
 * Helpers internos compartidos entre app/actions/leads.ts y app/actions/appointments.ts.
 * Este archivo NO tiene `'use server'` para que sus exports no se vuelvan server actions
 * invocables desde el cliente. Son utilidades server-only de uso interno.
 */

import 'server-only'

import { eq, and, sql, inArray, isNotNull, isNull, ne } from 'drizzle-orm'
import { getCurrentUser, type AppRole } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { db, dbAdmin, schema } from '@/lib/db'
import { parseSlaConfig, type SlaConfig } from '@/lib/leads/sla'
import { attachAttention } from '@/lib/leads/attention'
import { TERMINAL_STATUSES } from '@/lib/leads/constants'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'

// ── Subqueries de atención ────────────────────────────────────────
// Correlacionadas con leads.id. Reutilizadas por los queries de leads y
// por los conteos de atención por equipo. (No son server actions: este
// archivo es server-only, no 'use server'.)
//
// IMPORTANTE: la correlación se escribe con el literal `"leads"."id"`, NO con
// la interpolación ${schema.leads.id}. Drizzle renderiza la interpolación de
// una columna de forma DEPENDIENTE DEL CONTEXTO:
//   - en un query SIN join → `"id"` (sin calificar). Dentro del subquery ese
//     `"id"` resuelve a la columna `id` de la tabla interna (que también tiene
//     `id`) → `child.lead_id = child.id` → siempre falso → NULL.
//   - en un query CON join → `"leads"."id"` (calificado).
// Como estos subqueries se comparten entre getMyLeads (sin join) y getAllLeads
// (con join), la interpolación es inconsistente. El literal `"leads"."id"` es
// estable en ambos contextos (la tabla leads nunca se aliasa en estos queries).

/** Hora de la llamada pendiente (sin registrar) más próxima del lead. */
export const pendingCallAtSql = sql<string | null>`(
  SELECT MIN(lc.scheduled_at)
  FROM ${schema.leadCalls} lc
  WHERE lc.lead_id = "leads"."id"
    AND lc.realizada_at IS NULL
    AND lc.canceled_at IS NULL
)`

/** Hora de la cita 'programada' del lead (única por constraint). */
export const openApptAtSql = sql<string | null>`(
  SELECT la.scheduled_at
  FROM ${schema.leadAppointments} la
  WHERE la.lead_id = "leads"."id" AND la.status = 'programada'
  LIMIT 1
)`

/** Tipo de la cita 'programada' del lead (para mostrar en la card). */
export const openApptTipoSql = sql<string | null>`(
  SELECT la.tipo
  FROM ${schema.leadAppointments} la
  WHERE la.lead_id = "leads"."id" AND la.status = 'programada'
  LIMIT 1
)`

/** Valor final de la cotización de usado más reciente del lead (o null). */
export const usadoValorSql = sql<string | null>`(
  SELECT c.valor_final
  FROM ${schema.cotizaciones} c
  WHERE c.lead_id = "leads"."id"
  ORDER BY c.created_at DESC
  LIMIT 1
)`

/** ¿La cotización de usado más reciente fue rechazada? (null si no hay). */
export const usadoRechazadoSql = sql<boolean | null>`(
  SELECT c.rechazado
  FROM ${schema.cotizaciones} c
  WHERE c.lead_id = "leads"."id"
  ORDER BY c.created_at DESC
  LIMIT 1
)`

/** Marca/modelo del usado de la cotización más reciente del lead (o null). */
export const usadoMarcaSql = sql<string | null>`(
  SELECT c.marca_modelo
  FROM ${schema.cotizaciones} c
  WHERE c.lead_id = "leads"."id"
  ORDER BY c.created_at DESC
  LIMIT 1
)`

/** Nombre/alias de quien creó el lead (de usuarios). */
export const creatorNombreSql = sql<string | null>`(
  SELECT COALESCE(u.alias, u.nombre)
  FROM ${schema.usuarios} u
  WHERE u.id = "leads"."created_by"
  LIMIT 1
)`

/** Fecha de registro de venta (de registro_ventas). Null si el lead no fue vendido. */
export const ventaAtSql = sql<Date | null>`(
  SELECT rv.vendida_at
  FROM ${schema.registroVentas} rv
  WHERE rv.lead_id = "leads"."id"
  ORDER BY rv.vendida_at DESC
  LIMIT 1
)`

/**
 * Carga el usuario actual + tenant y arma el helper de queries.
 * Tira error si falta cualquiera de los dos.
 */
export async function requireTenant() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) throw new Error('No autenticado')
  const { q, forTenant } = db(tenantId)
  return { user, tenantId, q, forTenant }
}

/**
 * Expresión SQL que identifica leads "Demorados": activos (no terminales)
 * cuyo último contacto (o ingreso si nunca se contactó) supera el umbral de
 * horas del tenant. Reutilizable en agregaciones de dashboards.
 */
export function demoradoCondition(hours: number) {
  const terminales = sql.join(
    TERMINAL_STATUSES.map((s) => sql`${s}`),
    sql`, `,
  )
  return sql`${schema.leads.status} NOT IN (${terminales})
    AND COALESCE(${schema.leads.last_contact_at}, ${schema.leads.created_at})
        < NOW() - make_interval(hours => ${hours}::int)`
}

/**
 * Cuenta, por vendedor, cuántos de sus leads requieren atención (según el
 * engine derivado). Para el leaderboard de "Mi equipo".
 *
 * IMPORTANTE: recibe el scope (equipoIds) YA resuelto y verificado por el
 * caller (la page lo deriva del rol/equipos del usuario real). Es server-only,
 * no una action invocable desde el cliente, así que no hay riesgo de que se
 * pasen equipos ajenos.
 *
 * @param equipoIds  Equipos a incluir. `null` = todo el tenant (dueño/admin).
 *                   `[]` = ninguno → devuelve {}.
 */
export async function getTeamAttentionCountByUser(
  tenantId:  string,
  equipoIds: string[] | null,
): Promise<Record<string, number>> {
  if (equipoIds && equipoIds.length === 0) return {}

  const sla = await getTenantSlaConfig(tenantId)

  const conds = [
    eq(schema.leads.tenant_id, tenantId),
    isNotNull(schema.leads.assigned_to),
  ]
  if (equipoIds) conds.push(inArray(schema.leads.equipo_id, equipoIds))

  const rows = await dbAdmin
    .select({
      assigned_to:      schema.leads.assigned_to,
      status:           schema.leads.status,
      created_at:       schema.leads.created_at,
      last_contact_at:  schema.leads.last_contact_at,
      stage_entered_at: schema.leads.stage_entered_at,
      pending_call_at:  pendingCallAtSql,
      open_appt_at:     openApptAtSql,
    })
    .from(schema.leads)
    .where(and(...conds))

  const out: Record<string, number> = {}
  for (const r of rows) {
    if (!r.assigned_to) continue
    if (attachAttention(r, sla).at_risk) {
      out[r.assigned_to] = (out[r.assigned_to] ?? 0) + 1
    }
  }
  return out
}

/** Lee el SlaConfig del tenant (con defaults si no está seteado). */
export async function getTenantSlaConfig(tenantId: string): Promise<SlaConfig> {
  const row = await dbAdmin
    .select({ sla_config: schema.tenants.sla_config })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1)
  return parseSlaConfig(row[0]?.sla_config)
}

/**
 * Verifica que el usuario tenga acceso a un lead según su rol/equipo (no solo
 * por tenant). Reusa la jerarquía de equipos de lib/tenant/teams.ts.
 *
 * Devuelve el lead si tiene acceso, o `null` si:
 *   - el lead no existe / no es del tenant, o
 *   - el scope del usuario no lo alcanza.
 *
 * Reglas de scope (espejo de buildScopeWhere):
 *   - all (dueño/admin)     → cualquier lead del tenant
 *   - teams (gerente)       → lead.equipo_id ∈ sus equipos
 *   - team (supervisor)     → lead.equipo_id === su equipo
 *   - self (vendedor)       → assigned_to === user.id
 *                            OR (assigned_to IS NULL AND equipo_id === vendor's equipo)
 *   - none                  → ninguno
 */
export async function assertLeadAccess(
  leadId:   string,
  userId:   string,
  rol:      AppRole,
  tenantId: string,
) {
  const rows = await dbAdmin
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenant_id, tenantId)))
    .limit(1)

  const lead = rows[0]
  if (!lead) return null

  const scope = await getCurrentUserTeamScope(userId, tenantId, rol)

  switch (scope.type) {
    case 'all':
      return lead
    case 'teams':
      return lead.equipo_id && scope.equipoIds.includes(lead.equipo_id) ? lead : null
    case 'team':
      return lead.equipo_id === scope.equipoId ? lead : null
    case 'self':
      // Lead asignado al propio vendedor → ok siempre
      if (lead.assigned_to === userId) return lead
      // Lead asignado a otro → fuera de scope
      if (lead.assigned_to !== null) return null
      // Sin asignar: el vendedor solo accede si el lead es de su equipo
      // (o si ambos carecen de equipo)
      if (scope.equipoId) {
        return lead.equipo_id === scope.equipoId ? lead : null
      }
      return lead.equipo_id === null ? lead : null
    case 'none':
    default:
      return null
  }
}

/**
 * Inserta un evento en lead_timeline. Fire-and-forget desde el caller
 * (se puede await o void según necesidad).
 */
export async function appendTimeline(
  tenantId:    string,
  leadId:      string,
  actorId:     string,
  eventType:   string,
  title:       string,
  description?: string,
) {
  await dbAdmin.insert(schema.leadTimeline).values({
    tenant_id:   tenantId,
    lead_id:     leadId,
    actor_id:    actorId,
    event_type:  eventType,
    title,
    description: description ?? null,
  })
}

/**
 * Cancela la cita ACTIVA (status='programada') de un lead, si existe.
 * No hace regresión de estado del lead (se usa cuando el lead ya está
 * cambiando a un estado terminal y la regresión no aplica).
 * Registra evento en el timeline si hubo cancelación.
 *
 * Reutilizado por leads.ts (darDeBaja) y cotizaciones.ts (registrarVenta).
 */
export async function cancelActiveCita(
  tenantId: string,
  leadId:   string,
  actorId:  string,
  reason?:  string,
): Promise<void> {
  const canceled = await dbAdmin
    .update(schema.leadAppointments)
    .set({ status: 'cancelada', outcome_notes: reason ?? null, updated_at: new Date() })
    .where(and(
      eq(schema.leadAppointments.lead_id, leadId),
      eq(schema.leadAppointments.tenant_id, tenantId),
      eq(schema.leadAppointments.status, 'programada'),
    ))
    .returning({ id: schema.leadAppointments.id })

  if (canceled.length > 0) {
    await appendTimeline(
      tenantId, leadId, actorId,
      'appointment_cancelled',
      'Cita cancelada',
      reason,
    )
  }
}

/**
 * Cancela todas las llamadas PENDIENTES (sin registrar ni cancelar ya) de un
 * lead, opcionalmente excluyendo una por id (útil para no cancelar la que acaba
 * de ser agendada). Registra evento en el timeline si hubo cancelaciones.
 *
 * Retorna el número de llamadas canceladas.
 * Reutilizado por calls.ts (reemplazo al agendar), leads.ts (darDeBaja) y
 * cotizaciones.ts (registrarVenta).
 */
export async function cancelPendingCalls(
  tenantId: string,
  leadId:   string,
  actorId:  string,
  exceptId?: string,
): Promise<number> {
  const conds = [
    eq(schema.leadCalls.lead_id, leadId),
    eq(schema.leadCalls.tenant_id, tenantId),
    isNull(schema.leadCalls.realizada_at),
    isNull(schema.leadCalls.canceled_at),
  ]
  if (exceptId) conds.push(ne(schema.leadCalls.id, exceptId))

  const canceled = await dbAdmin
    .update(schema.leadCalls)
    .set({ canceled_at: new Date() })
    .where(and(...conds))
    .returning({ id: schema.leadCalls.id })

  if (canceled.length > 0) {
    await appendTimeline(
      tenantId, leadId, actorId,
      'call_canceled',
      canceled.length === 1
        ? 'Se canceló la llamada pendiente'
        : `Se cancelaron ${canceled.length} llamadas pendientes`,
    )
  }
  return canceled.length
}
