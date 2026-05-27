import { requireAuth } from '@/lib/auth/require-role'
import { getAppointmentsInRange } from '@/app/actions/appointments'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { AppointmentsView } from '@/components/appointments/appointments-view'
import { startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function CitasPage() {
  const user = await requireAuth()

  const now  = new Date()
  const from = startOfMonth(now)
  const to   = endOfMonth(now)

  const canSeeVendedores = ['platform_admin', 'dueno', 'gerente', 'supervisor'].includes(user.rol)

  const [appointments, vendedores] = await Promise.all([
    getAppointmentsInRange(from, to),
    canSeeVendedores ? getVendedoresDelTenant() : Promise.resolve([]),
  ])

  return (
    <AppointmentsView
      initialAppointments={appointments}
      initialMonth={from}
      vendedores={vendedores}
    />
  )
}
