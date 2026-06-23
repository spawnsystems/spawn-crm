import { requireAuth } from '@/lib/auth/require-role'
import { getMyLeads, getUnassignedLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getActiveModelNames } from '@/app/actions/modelos'
import { getSourcesCustom } from '@/app/actions/sources'
import { LeadsView } from '@/components/leads/leads-view'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const [user, leads, unassigned, vendedores, modelos, sourcesCustom] = await Promise.all([
    requireAuth(),
    getMyLeads(),
    getUnassignedLeads(),
    getVendedoresDelTenant(),
    getActiveModelNames(),
    getSourcesCustom(),
  ])

  const canCreate = true // todos los roles pueden capturar leads

  return (
    <LeadsView
      initialLeads={leads}
      initialUnassigned={unassigned}
      vendedores={vendedores}
      modelos={modelos}
      customSources={sourcesCustom.filter((s) => s.activo).map((s) => s.nombre)}
      canCreate={canCreate}
    />
  )
}
