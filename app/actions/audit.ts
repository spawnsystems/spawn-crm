'use server'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, desc, gte, lte } from 'drizzle-orm'

export async function getAuditLogs(filters?: {
  from?:   string  // ISO date
  to?:     string  // ISO date
  entity?: string
  actor?:  string
}) {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return []

  // Solo dueño y platform_admin pueden ver el audit
  if (!['platform_admin', 'dueno'].includes(user.rol)) return []

  const conditions = [
    eq(schema.auditLogs.tenant_id, tenantId),
    eq(schema.auditLogs.visible_to_dueno, true),
  ]

  if (filters?.from) {
    conditions.push(gte(schema.auditLogs.created_at, new Date(filters.from)))
  }
  if (filters?.to) {
    // +1 día para incluir el día completo
    const toDate = new Date(filters.to)
    toDate.setDate(toDate.getDate() + 1)
    conditions.push(lte(schema.auditLogs.created_at, toDate))
  }
  if (filters?.entity) {
    conditions.push(eq(schema.auditLogs.entity, filters.entity))
  }
  if (filters?.actor) {
    conditions.push(eq(schema.auditLogs.actor_id, filters.actor))
  }

  const rows = await dbAdmin
    .select({
      id:         schema.auditLogs.id,
      action:     schema.auditLogs.action,
      entity:     schema.auditLogs.entity,
      entity_id:  schema.auditLogs.entity_id,
      meta:       schema.auditLogs.meta,
      created_at: schema.auditLogs.created_at,
      actor_id:   schema.auditLogs.actor_id,
      actor_nombre: schema.usuarios.nombre,
      actor_alias:  schema.usuarios.alias,
    })
    .from(schema.auditLogs)
    .leftJoin(schema.usuarios, eq(schema.auditLogs.actor_id, schema.usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(schema.auditLogs.created_at))
    .limit(200)

  return rows
}
