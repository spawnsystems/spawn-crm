/**
 * lib/leads/server-helpers.ts
 *
 * Helpers internos compartidos entre app/actions/leads.ts y app/actions/appointments.ts.
 * Este archivo NO tiene `'use server'` para que sus exports no se vuelvan server actions
 * invocables desde el cliente. Son utilidades server-only de uso interno.
 */

import 'server-only'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { db, dbAdmin, schema } from '@/lib/db'

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
