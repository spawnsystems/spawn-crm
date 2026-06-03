/**
 * lib/leads/server-helpers.ts
 *
 * Helpers internos compartidos entre app/actions/leads.ts y app/actions/appointments.ts.
 * Este archivo NO tiene `'use server'` para que sus exports no se vuelvan server actions
 * invocables desde el cliente. Son utilidades server-only de uso interno.
 */

import 'server-only'

import { eq, and, sql } from 'drizzle-orm'
import { getCurrentUser, type AppRole } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { db, dbAdmin, schema } from '@/lib/db'
import { parseSlaConfig, type SlaConfig } from '@/lib/leads/sla'
import { TERMINAL_STATUSES } from '@/lib/leads/constants'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'

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
 *   - self (vendedor)       → assigned_to === user.id  OR  assigned_to === null (bandeja)
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
      return lead.assigned_to === userId || lead.assigned_to === null ? lead : null
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
