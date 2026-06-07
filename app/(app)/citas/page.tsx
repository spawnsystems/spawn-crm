import { requireAuth } from '@/lib/auth/require-role'
import { getAppointmentsInRange } from '@/app/actions/appointments'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { AppointmentsView } from '@/components/appointments/appointments-view'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function CitasPage() {
  const user = await requireAuth()

  const now  = new Date()
  // Rango de la grilla del mes (incluye días de semanas vecinas) para que la
  // vista Mes por defecto traiga también las citas de esos días.
  const from = startOfWeek(startOfMonth(now), { weekStartsOn: 1 })
  const to   = endOfWeek(endOfMonth(now),     { weekStartsOn: 1 })

  const canSeeVendedores = ['platform_admin', 'dueno', 'gerente', 'supervisor'].includes(user.rol)

  const [appointments, vendedores] = await Promise.all([
    getAppointmentsInRange(from, to),
    canSeeVendedores ? getVendedoresDelTenant() : Promise.resolve([]),
  ])

  return (
    <AppointmentsView
      initialAppointments={appointments}
      vendedores={vendedores}
    />
  )
}
