import { requireAuth } from '@/lib/auth/require-role'
import { getAppointmentsInRange } from '@/app/actions/appointments'
import { AppointmentsView } from '@/components/appointments/appointments-view'
import { startOfMonth, endOfMonth } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function CitasPage() {
  await requireAuth()

  const now   = new Date()
  const from  = startOfMonth(now)
  const to    = endOfMonth(now)

  const appointments = await getAppointmentsInRange(from, to)

  return (
    <AppointmentsView
      initialAppointments={appointments}
      initialMonth={from}
    />
  )
}
