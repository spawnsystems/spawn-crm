import { requireRole } from '@/lib/auth/require-role'
import { dbAdmin, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getTenantMembers } from '@/app/actions/platform'
import { MODULE_KEYS } from '@/lib/modules/definitions'
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

  // Estado efectivo: un módulo está activo salvo que exista una fila explícita
  // con enabled=false. Así los módulos sin fila se muestran prendidos (igual que
  // los ve la app), y solo lo explícitamente apagado aparece desmarcado.
  const disabled = new Set(moduleRows.filter((m) => !m.enabled).map((m) => m.module_key))
  const enabledModules = MODULE_KEYS.filter((k) => !disabled.has(k))

  return <TenantDetailView tenant={tenant} members={members} enabledModules={enabledModules} />
}
