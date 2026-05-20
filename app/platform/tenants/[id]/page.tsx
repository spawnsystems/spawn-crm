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

  const rows = await dbAdmin
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, id))
    .limit(1)

  const tenant = rows[0]
  if (!tenant) notFound()

  const members = await getTenantMembers(id)

  return <TenantDetailView tenant={tenant} members={members} />
}
