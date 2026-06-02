'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Inbox,
  Check,
  X,
  ArrowRight,
  BellOff,
  CheckCheck,
  Loader2,
  ArrowRightLeft,
} from 'lucide-react'
import {
  getMyTransferRequests,
  acceptTransfer,
  rejectTransfer,
  getMySentTransfers,
  cancelTransfer,
} from '@/app/actions/transfers'
import {
  getMyNotifications,
  markAllRead,
  markRead,
} from '@/app/actions/notifications'
import { StatusBadge } from '@/components/status-badge'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type TransferRequest = Awaited<ReturnType<typeof getMyTransferRequests>>[number]
type SentTransfer    = Awaited<ReturnType<typeof getMySentTransfers>>[number]
type Notification    = Awaited<ReturnType<typeof getMyNotifications>>[number]

// ── RejectDialog ──────────────────────────────────────────────────────────────

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open:         boolean
  onOpenChange: (v: boolean) => void
  onConfirm:    (motivo?: string) => void
  isPending:    boolean
}) {
  const [motivo, setMotivo] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rechazar traspaso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            Podés agregar un motivo opcional para el solicitante.
          </p>
          <Textarea
            placeholder="Ej: Ya tengo demasiados leads activos"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(motivo.trim() || undefined)}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── TransferCard ──────────────────────────────────────────────────────────────

function TransferCard({
  transfer,
  onDone,
}: {
  transfer: TransferRequest
  onDone:   () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen]  = useState(false)

  const fromName = transfer.from_alias || transfer.from_nombre || 'Vendedor'

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptTransfer(transfer.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Traspaso aceptado — el lead es tuyo')
      onDone()
    })
  }

  function handleReject(motivo?: string) {
    startTransition(async () => {
      const res = await rejectTransfer(transfer.id, motivo)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Traspaso rechazado')
      setRejectOpen(false)
      onDone()
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <ArrowRightLeft className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {transfer.lead_nombre ?? 'Lead sin nombre'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Solicita <span className="font-medium text-foreground">{fromName}</span>
              {' · '}
              {formatDistanceToNow(new Date(transfer.created_at), { locale: es, addSuffix: true })}
            </p>
          </div>
          {transfer.lead_status && (
            <StatusBadge status={transfer.lead_status} />
          )}
        </div>

        {/* Modelo y motivo */}
        {transfer.lead_modelo && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Interés:</span> {transfer.lead_modelo}
          </p>
        )}
        {transfer.motivo && (
          <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
            "{transfer.motivo}"
          </p>
        )}

        {/* Acciones */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={isPending}
            className="gap-1.5 flex-1"
          >
            {isPending
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Check className="size-3.5" />}
            Aceptar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRejectOpen(true)}
            disabled={isPending}
            className="gap-1.5 flex-1 text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
          >
            <X className="size-3.5" />
            Rechazar
          </Button>
        </div>
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={handleReject}
        isPending={isPending}
      />
    </>
  )
}

// ── SentTransferCard ──────────────────────────────────────────────────────────

function SentTransferCard({
  transfer,
  onDone,
}: {
  transfer: SentTransfer
  onDone:   () => void
}) {
  const [isPending, startTransition] = useTransition()
  const toName = transfer.to_alias || transfer.to_nombre || 'Vendedor'

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelTransfer(transfer.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Traspaso cancelado')
      onDone()
    })
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
      <ArrowRight className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{transfer.lead_nombre ?? 'Lead'}</p>
        <p className="text-xs text-muted-foreground">
          Esperando respuesta de <span className="font-medium">{toName}</span>
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCancel}
        disabled={isPending}
        className="text-muted-foreground hover:text-rose-600 shrink-0 h-7 px-2 text-xs"
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : 'Cancelar'}
      </Button>
    </div>
  )
}

// ── NotificationItem ──────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead:       () => void
}) {
  const [isPending, startTransition] = useTransition()
  const isUnread = !notification.read_at

  function handleRead() {
    if (!isUnread) return
    startTransition(async () => {
      await markRead(notification.id)
      onRead()
    })
  }

  const kindIcon = () => {
    if (notification.kind === 'transfer_request')  return <ArrowRightLeft className="size-3.5 text-primary" />
    if (notification.kind === 'transfer_accepted') return <Check className="size-3.5 text-emerald-600" />
    if (notification.kind === 'transfer_rejected') return <X className="size-3.5 text-rose-600" />
    return <Inbox className="size-3.5 text-muted-foreground" />
  }

  return (
    <button
      onClick={handleRead}
      disabled={isPending || !isUnread}
      className={cn(
        'w-full flex items-start gap-3 rounded-lg p-3 text-left transition-colors',
        isUnread
          ? 'bg-primary/5 hover:bg-primary/10 cursor-pointer'
          : 'bg-transparent cursor-default opacity-70',
      )}
    >
      <div className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full mt-0.5',
        isUnread ? 'bg-primary/15' : 'bg-muted',
      )}>
        {kindIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-tight', isUnread && 'font-semibold')}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{notification.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { locale: es, addSuffix: true })}
        </p>
      </div>
      {isUnread && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  )
}

// ── InboxView (main) ──────────────────────────────────────────────────────────

export function InboxView({
  initialTransfers,
  initialSent,
  initialNotifications,
}: {
  initialTransfers:    TransferRequest[]
  initialSent:         SentTransfer[]
  initialNotifications: Notification[]
}) {
  const [transfers,     setTransfers]     = useState(initialTransfers)
  const [sent,          setSent]          = useState(initialSent)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [isPending,     startTransition]  = useTransition()

  const refresh = useCallback(() => {
    startTransition(async () => {
      const [t, s, n] = await Promise.all([
        getMyTransferRequests(),
        getMySentTransfers(),
        getMyNotifications(),
      ])
      setTransfers(t)
      setSent(s)
      setNotifications(n)
    })
  }, [])

  // Auto-refresh al montar (datos pueden estar stale desde SSR)
  useEffect(() => { refresh() }, [refresh])

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() as unknown as Date })))
    })
  }

  const unreadCount   = notifications.filter((n) => !n.read_at).length
  const hasPending    = transfers.length > 0
  const hasSent       = sent.length > 0
  const hasNotifs     = notifications.length > 0

  return (
    <div className="max-w-lg mx-auto space-y-8 py-4">

      {/* ── Traspasos entrantes ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Traspasos pendientes</h2>
          {hasPending && (
            <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {transfers.length}
            </span>
          )}
        </div>

        {hasPending ? (
          <div className="space-y-3">
            {transfers.map((t) => (
              <TransferCard key={t.id} transfer={t} onDone={refresh} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-dashed">
            <ArrowRightLeft className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Sin traspasos pendientes</p>
          </div>
        )}
      </section>

      {/* ── Traspasos enviados (pendientes) ── */}
      {hasSent && (
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            Solicitudes enviadas
          </h2>
          <div className="space-y-2">
            {sent.map((t) => (
              <SentTransferCard key={t.id} transfer={t} onDone={refresh} />
            ))}
          </div>
        </section>
      )}

      {/* ── Historial de notificaciones ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Historial</h2>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="ml-auto h-6 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              Marcar todo leído
            </Button>
          )}
        </div>

        {hasNotifs ? (
          <div className="space-y-0.5 rounded-xl border overflow-hidden">
            {notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={refresh} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 rounded-xl border border-dashed">
            <BellOff className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Sin notificaciones</p>
          </div>
        )}
      </section>
    </div>
  )
}
