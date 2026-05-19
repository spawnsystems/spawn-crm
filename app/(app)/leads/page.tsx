import { requireAuth } from '@/lib/auth/require-role'
import { getMyLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { LeadsView } from '@/components/leads/leads-view'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const [user, leads, vendedores] = await Promise.all([
    requireAuth(),
    getMyLeads(),
    getVendedoresDelTenant(),
  ])

  const canCreate = ['platform_admin', 'dueno', 'gerente', 'supervisor'].includes(user.rol)

  return (
    <LeadsView
      initialLeads={leads}
      vendedores={vendedores}
      canCreate={canCreate}
    />
  )
}
