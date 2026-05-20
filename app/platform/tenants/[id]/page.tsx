import { requireRole } from '@/lib/auth/require-role'
import { dbAdmin, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getTenantMembers } from '@/app/actions/platform'
import { TenantDetailView } from './tenant-detail-view'

export const dynamic = 'force-dynamic'

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole('platform_admin')
  const { id } = await params

  const [rows, members, moduleRows] = await Promise.all([
    dbAdmin.select().from(schema.tenants).where(eq(schema.tenants.id, id)).limit(1),
    getTenantMembers(id),
    dbAdmin
      .select({ module_key: schema.tenantModules.module_key, enabled: schema.tenantModules.enabled })
      .from(schema.tenantModules)
      .where(eq(schema.tenantModules.tenant_id, id)),
  ])

  const tenant = rows[0]
  if (!tenant) notFound()

  const enabledModules = moduleRows.filter((m) => m.enabled).map((m) => m.module_key)

  return <TenantDetailView tenant={tenant} members={members} enabledModules={enabledModules} />
}
