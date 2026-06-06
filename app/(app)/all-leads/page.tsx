import { requireRole } from '@/lib/auth/require-role'
import { getAllLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getActiveModelNames } from '@/app/actions/modelos'
import { getSourcesCustom } from '@/app/actions/sources'
import { AllLeadsView } from '@/components/leads/all-leads-view'

export const dynamic = 'force-dynamic'

export default async function AllLeadsPage() {
  const [user, leads, vendedores, modelos, sourcesCustom] = await Promise.all([
    requireRole('supervisor'),
    getAllLeads(),
    getVendedoresDelTenant(),
    getActiveModelNames(),
    getSourcesCustom(),
  ])

  const canCreate = true // todos los roles pueden capturar leads

  return (
    <AllLeadsView
      initialLeads={leads}
      vendedores={vendedores}
      modelos={modelos}
      customSources={sourcesCustom.filter((s) => s.activo).map((s) => s.nombre)}
      canCreate={canCreate}
    />
  )
}
