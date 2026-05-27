'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn, formatCurrencyARS } from '@/lib/utils'
import { LifeBuoy, UserPlus, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { assignLead, reactivateFromRescue, type getAbandonedLeads } from '@/app/actions/leads'
import type { getVendedoresDelTenant } from '@/app/actions/users'

type LeadRow = Awaited<ReturnType<typeof getAbandonedLeads>>[number]

interface RescueViewProps {
  initialLeads: LeadRow[]
  vendedores:   Awaited<ReturnType<typeof getVendedoresDelTenant>>
}

export function RescueView({ initialLeads, vendedores }: RescueViewProps) {
  const [leads,            setLeads]            = useState<LeadRow[]>(initialLeads)
  const [reassignLead,     setReassignLead]     = useState<LeadRow | null>(null)
  const [selectedVendedor, setSelectedVendedor] = useState('')
  const [isPending,        startTransition]     = useTransition()

  function handleReactivate(leadId: string) {
    startTransition(async () => {
      const res = await reactivateFromRescue(leadId)
      if (res.success) {
        toast.success('Lead reactivado', { description: 'Volvió a estado Contactado.' })
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

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <LifeBuoy className="size-5 text-amber-600" />
          <h1 className="text-2xl font-semibold tracking-tight">Rescate de leads</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Leads inactivos por +15 días — campaña de reactivación.
          Reactivá un lead para devolverlo al flujo, o reasignalo a otro vendedor.
        </p>
      </div>

      {/* Contador */}
      <div className="mb-5 text-sm text-muted-foreground">
        {leads.length === 0
          ? 'No hay leads en rescate.'
          : `${leads.length} lead${leads.length !== 1 ? 's' : ''} para rescatar`}
      </div>

      {/* Lead cards */}
      {leads.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl">
          🎉 Ningún lead inactivo. Todo bajo control.
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <RescueCard
              key={lead.id}
              lead={lead}
              isPending={isPending}
              onReassign={() => setReassignLead(lead)}
              onReactivate={() => handleReactivate(lead.id)}
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
            <Button onClick={handleReassign} disabled={!selectedVendedor || isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Reasignar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Lead card ─────────────────────────────────────────────────────

function RescueCard({ lead, isPending, onReassign, onReactivate }: {
  lead:         LeadRow
  isPending:    boolean
  onReassign:   () => void
  onReactivate: () => void
}) {
  const vendorName     = lead.vendedor_alias || lead.vendedor_nombre
  const daysAgo        = lead.abandoned_at
    ? Math.floor((Date.now() - new Date(lead.abandoned_at).getTime()) / 86_400_000)
    : 0
  const formattedValue = formatCurrencyARS(lead.est_value, { compact: true })
  const hasValue       = formattedValue !== '—'

  return (
    <div className={cn(
      'relative rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow pl-[4px]',
      'border-amber-200/60',
    )}>
      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-amber-500/60" />
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
          {daysAgo > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-2 py-0.5 shrink-0 mt-0.5">
              Inactivo hace {daysAgo} días
            </span>
          )}
        </div>

        {/* Row 2 */}
        <div className="text-xs text-muted-foreground mb-4">
          {vendorName && (
            <>
              Vendedor: <span className="font-medium text-foreground/70">{vendorName}</span>
            </>
          )}
          {hasValue && (
            <>
              {vendorName && <span className="mx-2">·</span>}
              Valor: <span className="font-medium text-foreground/70">{formattedValue}</span>
            </>
          )}
        </div>

        {/* Row 3 — actions */}
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
            className="gap-1.5"
            onClick={onReactivate}
            disabled={isPending}
          >
            <RotateCcw className="size-3.5" />
            Reactivar contacto
          </Button>
        </div>
      </div>
    </div>
  )
}
