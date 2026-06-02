import { requireRole } from '@/lib/auth/require-role'
import { getAllLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getActiveModelNames } from '@/app/actions/modelos'
import { AllLeadsView } from '@/components/leads/all-leads-view'

export const dynamic = 'force-dynamic'

export default async function AllLeadsPage() {
  const [user, leads, vendedores, modelos] = await Promise.all([
    requireRole('supervisor'),
    getAllLeads(),
    getVendedoresDelTenant(),
    getActiveModelNames(),
  ])

  const canCreate = true // todos los roles pueden capturar leads

  return (
    <AllLeadsView
      initialLeads={leads}
      vendedores={vendedores}
      modelos={modelos}
      canCreate={canCreate}
    />
  )
}
