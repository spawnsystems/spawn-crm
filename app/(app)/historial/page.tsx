import { requireAuth } from '@/lib/auth/require-role'
import { requireModule } from '@/lib/modules/server'
import { getHistorialLeads } from '@/app/actions/leads'
import { HistorialView } from '@/components/leads/historial-view'

export const metadata = { title: 'Historial de leads — Spawn CRM' }
export const dynamic  = 'force-dynamic'

export default async function HistorialPage() {
  await requireModule('historial')
  const [user, leads] = await Promise.all([
    requireAuth(),
    getHistorialLeads(),
  ])

  // Supervisor+ puede ver y filtrar por vendedor
  const canSeeVendedor = ['platform_admin', 'dueno', 'gerente', 'supervisor'].includes(user.rol)

  return <HistorialView initialLeads={leads} canSeeVendedor={canSeeVendedor} />
}
