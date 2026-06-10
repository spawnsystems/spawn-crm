import { requireRole } from '@/lib/auth/require-role'
import { requireModule } from '@/lib/modules/server'
import { getAbandonedLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { RescueView } from '@/components/rescue/rescue-view'

export const dynamic = 'force-dynamic'

export default async function RescatePage() {
  await requireModule('rescate')
  const [, leads, vendedores] = await Promise.all([
    requireRole('supervisor'),
    getAbandonedLeads(),
    getVendedoresDelTenant(),
  ])

  return <RescueView initialLeads={leads} vendedores={vendedores} />
}
