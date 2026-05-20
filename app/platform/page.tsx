import { requireRole } from '@/lib/auth/require-role'
import { dbAdmin, schema } from '@/lib/db'
import { count, eq, and } from 'drizzle-orm'
import { PlatformView } from './platform-view'

export const dynamic = 'force-dynamic'

export default async function PlatformPage() {
  const user = await requireRole('platform_admin')

  // Tenants + stats in one go
  const tenants = await dbAdmin
    .select()
    .from(schema.tenants)
    .orderBy(schema.tenants.created_at)

  // For each tenant get member count + lead count in parallel
  const statsArr = await Promise.all(
    tenants.map(async (t) => {
      const [members, leads] = await Promise.all([
        dbAdmin
          .select({ count: count() })
          .from(schema.tenantMembers)
          .where(and(
            eq(schema.tenantMembers.tenant_id, t.id),
            eq(schema.tenantMembers.activo, true),
          )),
        dbAdmin
          .select({ count: count() })
          .from(schema.leads)
          .where(eq(schema.leads.tenant_id, t.id)),
      ])
      return {
        tenantId:    t.id,
        memberCount: members[0]?.count ?? 0,
        leadCount:   leads[0]?.count   ?? 0,
      }
    }),
  )

  const statsMap = Object.fromEntries(statsArr.map((s) => [s.tenantId, s]))

  const tenantsWithStats = tenants.map((t) => ({
    ...t,
    memberCount: statsMap[t.id]?.memberCount ?? 0,
    leadCount:   statsMap[t.id]?.leadCount   ?? 0,
  }))

  return <PlatformView user={user} tenants={tenantsWithStats} />
}
