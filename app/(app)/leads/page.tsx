import { requireAuth } from '@/lib/auth/require-role'
import { getMyLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getActiveModelNames } from '@/app/actions/modelos'
import { LeadsView } from '@/components/leads/leads-view'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const [user, leads, vendedores, modelos] = await Promise.all([
    requireAuth(),
    getMyLeads(),
    getVendedoresDelTenant(),
    getActiveModelNames(),
  ])

  const canCreate = true // todos los roles pueden capturar leads

  return (
    <LeadsView
      initialLeads={leads}
      vendedores={vendedores}
      modelos={modelos}
      canCreate={canCreate}
    />
  )
}
