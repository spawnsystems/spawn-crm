import { Inbox } from 'lucide-react'
import { InboxView } from '@/components/notifications/inbox-view'
import { getMyTransferRequests, getMySentTransfers } from '@/app/actions/transfers'
import { getMyNotifications } from '@/app/actions/notifications'

export const metadata = { title: 'Bandeja — Spawn CRM' }

export default async function BandejaPage() {
  const [transfers, sent, notifications] = await Promise.all([
    getMyTransferRequests(),
    getMySentTransfers(),
    getMyNotifications(),
  ])

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-4 shrink-0">
        <Inbox className="size-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold leading-tight">Bandeja de entrada</h1>
          <p className="text-xs text-muted-foreground">
            Traspasos y notificaciones del equipo
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <InboxView
          initialTransfers={transfers}
          initialSent={sent}
          initialNotifications={notifications}
        />
      </div>
    </div>
  )
}
