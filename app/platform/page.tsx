import { requireRole } from '@/lib/auth/require-role'
import { dbAdmin, schema } from '@/lib/db'
import { count, eq, and } from 'drizzle-orm'
import { PlatformView } from './platform-view'

export const dynamic = 'force-dynamic'

export default async function PlatformPage() {
  const user = await requireRole('platform_admin')

  const tenants = await dbAdmin
    .select()
    .from(schema.tenants)
    .orderBy(schema.tenants.created_at)

  // Member count per tenant (active only)
  const memberCounts = await Promise.all(
    tenants.map(async (t) => {
      const rows = await dbAdmin
        .select({ count: count() })
        .from(schema.tenantMembers)
        .where(and(
          eq(schema.tenantMembers.tenant_id, t.id),
          eq(schema.tenantMembers.activo, true),
        ))
      return { tenantId: t.id, memberCount: rows[0]?.count ?? 0 }
    }),
  )

  const memberMap = Object.fromEntries(memberCounts.map((s) => [s.tenantId, s.memberCount]))

  const tenantsWithStats = tenants.map((t) => ({
    ...t,
    memberCount: memberMap[t.id] ?? 0,
  }))

  return <PlatformView user={user} tenants={tenantsWithStats} />
}
