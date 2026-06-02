import { requireAuth } from '@/lib/auth/require-role'
import { getHistorialLeads } from '@/app/actions/leads'
import { HistorialView } from '@/components/leads/historial-view'

export const metadata = { title: 'Historial de leads — Spawn CRM' }
export const dynamic  = 'force-dynamic'

export default async function HistorialPage() {
  const [user, leads] = await Promise.all([
    requireAuth(),
    getHistorialLeads(),
  ])

  // Supervisor+ puede ver y filtrar por vendedor
  const canSeeVendedor = ['platform_admin', 'dueno', 'gerente', 'supervisor'].includes(user.rol)

  return <HistorialView initialLeads={leads} canSeeVendedor={canSeeVendedor} />
}
