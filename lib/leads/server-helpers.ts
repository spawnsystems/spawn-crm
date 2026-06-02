/**
 * lib/leads/server-helpers.ts
 *
 * Helpers internos compartidos entre app/actions/leads.ts y app/actions/appointments.ts.
 * Este archivo NO tiene `'use server'` para que sus exports no se vuelvan server actions
 * invocables desde el cliente. Son utilidades server-only de uso interno.
 */

import 'server-only'

import { eq, sql } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { db, dbAdmin, schema } from '@/lib/db'
import { parseSlaConfig, type SlaConfig } from '@/lib/leads/sla'
import { TERMINAL_STATUSES } from '@/lib/leads/constants'

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
