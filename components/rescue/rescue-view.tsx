'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn, formatCurrencyARS } from '@/lib/utils'
import { Info, LifeBuoy, UserPlus, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { assignLead, markAsLost, type getAbandonedLeads } from '@/app/actions/leads'
import type { getVendedoresDelTenant } from '@/app/actions/users'

type LeadRow = Awaited<ReturnType<typeof getAbandonedLeads>>[number]

type RescueCategory = 'all' | 'cotizado_sin_respuesta' | 'no_se_presento' | 'negociacion_abandonada'

const FILTER_LABELS: { id: RescueCategory; label: string }[] = [
  { id: 'all',                     label: 'Todos' },
  { id: 'cotizado_sin_respuesta',  label: 'Cotizados sin respuesta' },
  { id: 'no_se_presento',         label: 'No se presentaron' },
  { id: 'negociacion_abandonada', label: 'Negociación abandonada' },
]

const RESCUE_LABELS: Record<string, string> = {
  cotizado_sin_respuesta:  'Cotizado sin respuesta',
  no_se_presento:         'No se presentó',
  negociacion_abandonada: 'Negociación abandonada',
}

interface RescueViewProps {
  initialLeads: LeadRow[]
  vendedores: Awaited<ReturnType<typeof getVendedoresDelTenant>>
}

export function RescueView({ initialLeads, vendedores }: RescueViewProps) {
  const [leads, setLeads]             = useState<LeadRow[]>(initialLeads)
  const [activeFilter, setActiveFilter] = useState<RescueCategory>('all')
  const [reassignLead, setReassignLead] = useState<LeadRow | null>(null)
  const [selectedVendedor, setSelectedVendedor] = useState('')
  const [isPending, startTransition]  = useTransition()

  const filtered = activeFilter === 'all'
    ? leads
    : leads.filter((l) => l.rescue_category === activeFilter)

  function handleMarkLost(leadId: string) {
    startTransition(async () => {
      const res = await markAsLost(leadId)
      if (res.success) {
        toast.success('Lead marcado como Perdido')
        setLeads((ls) => ls.filter((l) => l.id !== leadId))
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleReassign() {
    if (!reassignLead || !selectedVendedor) return
    startTransition(async () => {
      const res = await assignLead(reassignLead.id, selectedVendedor)
      if (res.success) {
        toast.success('Lead reasignado')
        setLeads((ls) => ls.filter((l) => l.id !== reassignLead.id))
        setReassignLead(null)
        setSelectedVendedor('')
      } else {
        toast.error(res.error)
      }
    })
  }

  // Build filter labels with counts
  const filters = FILTER_LABELS.map((f) => ({
    ...f,
    count: f.id === 'all' ? leads.length : leads.filter((l) => l.rescue_category === f.id).length,
  }))

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <LifeBuoy className="size-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Rescate de leads</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Leads abandonados hace +15 días — Campaña de reactivación
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-5 border-b border-border">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeFilter === f.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Lead cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No hay leads en esta categoría. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <RescueCard
              key={lead.id}
              lead={lead}
              isPending={isPending}
              onReassign={() => setReassignLead(lead)}
              onMarkLost={() => handleMarkLost(lead.id)}
            />
          ))}
        </div>
      )}

      {/* Reassign dialog */}
      <Dialog open={!!reassignLead} onOpenChange={(v) => { if (!v) { setReassignLead(null); setSelectedVendedor('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reasignar lead</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-3">
              Asignando: <span className="font-medium text-foreground">{reassignLead?.nombre}</span>
            </p>
            <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir vendedor..." />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map((v) => {
                  const name = v.alias || v.nombre || v.user_id
                  return (
                    <SelectItem key={v.user_id} value={v.user_id}>{name}</SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignLead(null)}>Cancelar</Button>
            <Button
              onClick={handleReassign}
              disabled={!selectedVendedor || isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Reasignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Lead card ─────────────────────────────────────────────────────

function RescueCard({ lead, isPending, onReassign, onMarkLost }: {
  lead: LeadRow
  isPending: boolean
  onReassign: () => void
  onMarkLost: () => void
}) {
  const vendorName  = lead.vendedor_alias || lead.vendedor_nombre
  const daysAgo     = lead.abandoned_at
    ? Math.floor((Date.now() - new Date(lead.abandoned_at).getTime()) / 86_400_000)
    : 0
  const formattedValue = formatCurrencyARS(lead.est_value, { compact: true })
  const hasValue       = formattedValue !== '—'

  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow pl-[4px]">
      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-muted-foreground/30" />
      <div className="p-5">
        {/* Row 1 */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base">{lead.nombre}</span>
            {lead.modelo && (
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {lead.modelo}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
            Hace {daysAgo} días
          </span>
        </div>

        {/* Row 2 */}
        <div className="text-xs text-muted-foreground mb-2.5">
          Estado al abandono: <span className="font-medium text-foreground/70">{lead.status}</span>
          {vendorName && (
            <>
              <span className="mx-2">·</span>
              Vendedor: <span className="font-medium text-foreground/70">{vendorName}</span>
            </>
          )}
          {hasValue && (
            <>
              <span className="mx-2">·</span>
              Valor: <span className="font-medium text-foreground/70">{formattedValue}</span>
            </>
          )}
        </div>

        {/* Row 3 — category tag */}
        {lead.rescue_category && (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 mb-4">
            <Info className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              {RESCUE_LABELS[lead.rescue_category] ?? lead.rescue_category}
            </span>
          </div>
        )}

        {/* Row 4 — actions */}
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onReassign}
            disabled={isPending}
          >
            <UserPlus className="size-3.5" />
            Reasignar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={onMarkLost}
            disabled={isPending}
          >
            <XCircle className="size-3.5" />
            Marcar como perdido
          </Button>
        </div>
      </div>
    </div>
  )
}
