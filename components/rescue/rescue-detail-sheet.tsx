'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import {
  Phone, Mail, Car, MapPin, Clock3, UserCircle, UserPlus, RotateCcw,
  Loader2, FileText, History, Calculator,
} from 'lucide-react'
import { getLeadDetail } from '@/app/actions/leads'
import { isBaja } from '@/lib/leads/constants'
import { formatHorarios } from '@/lib/leads/horarios'
import { cn, formatCurrencyARS, fmtDayMonthAR, toBADate } from '@/lib/utils'
import type { getAbandonedLeads } from '@/app/actions/leads'

type LeadRow    = Awaited<ReturnType<typeof getAbandonedLeads>>[number]
type DetailData = Awaited<ReturnType<typeof getLeadDetail>>

interface RescueDetailSheetProps {
  lead:         LeadRow | null
  onClose:      () => void
  onReassign:   (lead: LeadRow) => void
  onReactivate: (leadId: string) => void
  isPending:    boolean
}

export function RescueDetailSheet({
  lead, onClose, onReassign, onReactivate, isPending,
}: RescueDetailSheetProps) {
  const [detail,  setDetail]  = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!lead) { setDetail(null); return }
    setDetail(null)
    setLoading(true)
    let cancelled = false

    getLeadDetail(lead.id)
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch((err) => {
        if (cancelled) return
        console.error('[rescue-detail-sheet] load', err)
        toast.error('No se pudo cargar el lead')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [lead])

  const vendorName = lead ? (lead.vendedor_alias || lead.vendedor_nombre) : null
  const enBaja     = lead ? isBaja(lead.status) : false
  const refDate    = lead ? (lead.baja_at ?? lead.abandoned_at) : null
  const daysAgo    = refDate
    ? Math.floor((Date.now() - new Date(refDate).getTime()) / 86_400_000)
    : 0

  const d            = detail?.lead
  const notes        = detail?.notes        ?? []
  const timeline     = detail?.timeline     ?? []
  const cotizaciones = detail?.cotizaciones ?? []

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && lead && (
          <div className="flex flex-col min-h-full">
            {/* ── Header ── */}
            <SheetHeader className="p-6 border-b border-border space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-xl">{lead.nombre}</SheetTitle>
                {lead.modelo && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Car className="size-4 text-primary" />{lead.modelo}
                  </span>
                )}
                <StatusBadge status={lead.status} />
                {daysAgo > 0 && (
                  <span className={cn(
                    'text-xs rounded px-2 py-0.5 border',
                    enBaja
                      ? 'text-rose-700 bg-rose-50 border-rose-200/60'
                      : 'text-amber-700 bg-amber-50 border-amber-200/60',
                  )}>
                    {enBaja ? 'Dado de baja' : 'Inactivo'} hace {daysAgo} días
                  </span>
                )}
              </div>

              {/* Vendedor + valor */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {vendorName && (
                  <span className="inline-flex items-center gap-1.5">
                    <UserCircle className="size-3.5" />
                    Vendedor: <span className="font-medium text-foreground/80">{vendorName}</span>
                  </span>
                )}
                {formatCurrencyARS(lead.est_value, { compact: true }) !== '—' && (
                  <span>
                    Valor: <span className="font-medium text-foreground/80">
                      {formatCurrencyARS(lead.est_value, { compact: true })}
                    </span>
                  </span>
                )}
              </div>

              {/* Motivo de baja */}
              {enBaja && lead.baja_motivo && (
                <div className="text-xs text-rose-700/80 bg-rose-50 border border-rose-200/50 rounded-md px-3 py-2 italic">
                  Motivo de baja: "{lead.baja_motivo}"
                </div>
              )}
            </SheetHeader>

            {/* ── Body ── */}
            <div className="flex-1 p-6 space-y-6">
              {/* Datos de contacto */}
              <Section icon={<UserCircle className="size-4" />} title="Datos del lead">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <DataRow icon={<Phone className="size-3.5" />}  label="Teléfono"  value={d?.telefono} />
                  <DataRow icon={<Mail className="size-3.5" />}   label="Email"     value={d?.email} />
                  <DataRow
                    icon={<MapPin className="size-3.5" />}
                    label="Ubicación"
                    value={[d?.localidad, d?.provincia].filter(Boolean).join(', ') || null}
                  />
                  <DataRow
                    icon={<Clock3 className="size-3.5" />}
                    label="Horario"
                    value={formatHorarios(d?.horario_preferencia ?? null) || null}
                  />
                </div>
                {d?.creator_nombre && (
                  <p className="mt-2 text-xs text-muted-foreground/70 inline-flex items-center gap-1.5">
                    <UserPlus className="size-3" />
                    Cargado por <span className="font-medium text-foreground/70">{d.creator_nombre}</span>
                  </p>
                )}
              </Section>

              {/* Usado / cotizaciones */}
              {cotizaciones.length > 0 && (
                <Section icon={<Calculator className="size-4" />} title="Usado en parte de pago">
                  <div className="space-y-1.5">
                    {cotizaciones.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-amber-200/50 bg-amber-50/50 px-3 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate text-amber-900/80">
                          {c.marca_modelo || 'Usado'}
                          {c.anio ? ` · ${c.anio}` : ''}
                        </span>
                        <span className={cn(
                          'shrink-0 text-xs font-medium',
                          c.rechazado ? 'text-rose-500' : 'text-amber-700',
                        )}>
                          {c.rechazado ? 'Rechazado' : formatCurrencyARS(c.valor_final)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Notas internas */}
              {notes.length > 0 && (
                <Section icon={<FileText className="size-4" />} title="Notas internas">
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          {n.autor ?? 'Usuario'} · {fmtDayMonthAR(n.created_at)}
                        </div>
                        <div className="text-sm">{n.texto}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Historial */}
              <Section icon={<History className="size-4" />} title="Historial">
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-3">
                      {timeline.map((e) => (
                        <div key={e.id} className="relative flex gap-3 pl-0">
                          <div className="relative z-10 mt-1 size-[11px] shrink-0 rounded-full bg-primary ring-2 ring-background" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] text-muted-foreground leading-none mb-0.5">
                              {format(toBADate(e.created_at), 'dd/MM HH:mm')}
                            </div>
                            <div className="text-sm font-medium">{e.title}</div>
                            {e.description && (
                              <div className="text-xs text-muted-foreground mt-0.5">{e.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            </div>

            {/* ── Footer acciones ── */}
            <div className="sticky bottom-0 border-t border-border bg-card p-4 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => onReassign(lead)}
                disabled={isPending}
              >
                <UserPlus className="size-4" />
                Reasignar
              </Button>
              <Button
                className="gap-1.5"
                onClick={() => onReactivate(lead.id)}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Reactivar contacto
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────

function Section({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

function DataRow({ icon, label, value }: {
  icon: React.ReactNode
  label: string
  value?: string | null
}) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="text-xs">{label}:</span>
      <span className={cn('text-sm', value ? 'text-foreground' : 'text-muted-foreground/60 italic')}>
        {value || 'Sin datos'}
      </span>
    </div>
  )
}
