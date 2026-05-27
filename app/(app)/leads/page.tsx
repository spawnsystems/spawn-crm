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

  const canCreate = ['dueno', 'gerente', 'supervisor'].includes(user.rol)

  return (
    <LeadsView
      initialLeads={leads}
      vendedores={vendedores}
      modelos={modelos}
      canCreate={canCreate}
    />
  )
}
