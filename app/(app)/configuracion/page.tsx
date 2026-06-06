import { requireAuth } from '@/lib/auth/require-role'
import { getCurrentTenant } from '@/lib/tenant/server'
import { getMiembrosDelTenant, getEquiposConMiembros } from '@/app/actions/equipos'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getModelosVehiculo } from '@/app/actions/modelos'
import { getSourcesCustom } from '@/app/actions/sources'
import { getMetasMensuales } from '@/app/actions/metas'
import { getAuditLogs } from '@/app/actions/audit'
import { getTenantSlaConfig } from '@/lib/leads/server-helpers'
import { DEFAULT_SLA } from '@/lib/leads/sla'
import { ConfiguracionView } from '@/components/config/configuracion-view'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sp = await searchParams
  const tab = typeof sp.tab === 'string' ? sp.tab : 'cuenta'

  const now         = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const [user, tenant, miembros, equipos, modelos, sourcesCustom, vendedores, metas, auditLogs] =
    await Promise.all([
      requireAuth(),
      getCurrentTenant(),
      getMiembrosDelTenant(),
      getEquiposConMiembros(),
      getModelosVehiculo(),
      getSourcesCustom(),
      getVendedoresDelTenant(),
      getMetasMensuales(currentYear),
      getAuditLogs(),
    ])

  const canManage         = ['dueno'].includes(user.rol)
  const canManageModelos  = ['dueno', 'gerente'].includes(user.rol)
  // vendedor y supervisor solo ven "Mi cuenta"
  const canSeeConfig      = ['dueno', 'gerente'].includes(user.rol)

  const sla = tenant ? await getTenantSlaConfig(tenant.id) : DEFAULT_SLA

  return (
    <ConfiguracionView
      user={user}
      tenant={tenant}
      miembros={miembros}
      equipos={equipos}
      modelos={modelos}
      sourcesCustom={sourcesCustom}
      metas={metas}
      auditLogs={auditLogs}
      vendedores={vendedores}
      sla={sla}
      canManage={canManage}
      canManageModelos={canManageModelos}
      canSeeConfig={canSeeConfig}
      currentYear={currentYear}
      currentMonth={currentMonth}
      defaultTab={tab}
    />
  )
}
