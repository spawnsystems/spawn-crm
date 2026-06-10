import { requireAuth } from '@/lib/auth/require-role'
import { requireModule } from '@/lib/modules/server'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { redirect } from 'next/navigation'
import { getVentas } from '@/app/actions/ventas'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getMetasVentasMap } from '@/lib/leads/server-helpers'
import { currentYearMonthAR } from '@/lib/utils'
import { VentasView } from '@/components/ventas/ventas-view'

export const metadata = { title: 'Ventas — Spawn CRM' }
export const dynamic  = 'force-dynamic'

export default async function VentasPage() {
  await requireModule('ventas')
  const [user, tenantId] = await Promise.all([requireAuth(), getCurrentTenantId()])
  if (!tenantId) redirect('/login')

  const { year: curYear, month: curMonth } = currentYearMonthAR()

  const [ventas, vendedores, metasMap] = await Promise.all([
    getVentas(),
    getVendedoresDelTenant(),
    getMetasVentasMap(tenantId, curYear, curMonth),
  ])

  // Meta del mes para el alcance del usuario: suma de las metas de los
  // vendedores que ve (vendedor → su propia meta; jefe → la de su equipo).
  const totalMeta = vendedores.reduce((acc, v) => acc + (metasMap[v.user_id] ?? 0), 0)

  // Supervisor+ puede filtrar por vendedor; el vendedor solo se ve a sí mismo.
  const canSeeVendedor = ['platform_admin', 'dueno', 'gerente', 'supervisor'].includes(user.rol)

  return (
    <VentasView
      ventas={ventas}
      vendedores={vendedores}
      totalMeta={totalMeta}
      currentYear={curYear}
      currentMonth={curMonth}
      canSeeVendedor={canSeeVendedor}
      rol={user.rol}
    />
  )
}
