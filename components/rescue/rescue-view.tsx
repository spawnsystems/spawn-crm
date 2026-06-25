'use client'

import { useState, useTransition, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Paginator } from '@/components/ui/paginator'
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
import { StatusBadge } from '@/components/status-badge'
import { RescueDetailSheet } from '@/components/rescue/rescue-detail-sheet'
import { isBaja } from '@/lib/leads/constants'

type LeadRow = Awaited<ReturnType<typeof getAbandonedLeads>>[number]

const PAGE_SIZE = 10
const FILTER_ALL = '__all__'
const FILTER_SIN = '__sin__'   // leads sin vendedor asignado

interface RescueViewProps {
  initialLeads: LeadRow[]
  vendedores:   Awaited<ReturnType<typeof getVendedoresDelTenant>>
}

export function RescueView({ initialLeads, vendedores }: RescueViewProps) {
  const [leads,            setLeads]            = useState<LeadRow[]>(initialLeads)
  const [reassignLead,     setReassignLead]     = useState<LeadRow | null>(null)
  const [selectedVendedor, setSelectedVendedor] = useState('')
  const [detailLead,       setDetailLead]       = useState<LeadRow | null>(null)
  const [isPending,        startTransition]     = useTransition()
  const [page,             setPage]             = useState(1)
  const [filterVendedor,   setFilterVendedor]   = useState(FILTER_ALL)

  // Opciones del filtro derivadas de los propios leads de rescate (no de la lista
  // de vendedores activos): así respeta la jerarquía automáticamente (los leads ya
  // vienen scopeados por getAbandonedLeads) e incluye vendedores dados de baja que
  // todavía tengan leads acá.
  const { vendedoresEnRescate, haySinAsignar } = useMemo(() => {
    const map = new Map<string, string>()
    let sinAsignar = false
    for (const l of leads) {
      if (!l.assigned_to) { sinAsignar = true; continue }
      if (!map.has(l.assigned_to)) {
        map.set(l.assigned_to, l.vendedor_alias || l.vendedor_nombre || l.assigned_to)
      }
    }
    const arr = Array.from(map, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return { vendedoresEnRescate: arr, haySinAsignar: sinAsignar }
  }, [leads])

  const filtered = useMemo(() => {
    if (filterVendedor === FILTER_ALL) return leads
    if (filterVendedor === FILTER_SIN) return leads.filter((l) => !l.assigned_to)
    return leads.filter((l) => l.assigned_to === filterVendedor)
  }, [leads, filterVendedor])

  // Si el vendedor filtrado ya no tiene leads en rescate (lo reasignaron todo),
  // volvemos a "Todos" para no quedar mirando una lista vacía.
  useEffect(() => {
    if (filterVendedor === FILTER_ALL || filterVendedor === FILTER_SIN) return
    if (!vendedoresEnRescate.some((v) => v.id === filterVendedor)) {
      setFilterVendedor(FILTER_ALL)
    }
  }, [vendedoresEnRescate, filterVendedor])

  // Reset a página 1 cuando cambia el filtro
  useEffect(() => { setPage(1) }, [filterVendedor])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleReactivate(leadId: string) {
    startTransition(async () => {
      const res = await reactivateFromRescue(leadId)
      if (res.success) {
        toast.success('Lead reactivado', { description: 'Volvió a GESTIÓN — asignalo a un vendedor.' })
        setLeads((ls) => ls.filter((l) => l.id !== leadId))
        setDetailLead((d) => d?.id === leadId ? null : d)
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleReassign() {
    if (!reassignLead || !selectedVendedor) return
    const leadId = reassignLead.id
    startTransition(async () => {
      const res = await assignLead(leadId, selectedVendedor)
      if (res.success) {
        toast.success('Lead reasignado')
        setLeads((ls) => ls.filter((l) => l.id !== leadId))
        setReassignLead(null)
        setSelectedVendedor('')
        setDetailLead((d) => d?.id === leadId ? null : d)
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
          Leads dados de baja (rescatables) y leads inactivos sin contacto.
          Reactivá un lead para devolverlo al flujo de GESTIÓN, o reasignalo a otro vendedor.
        </p>
      </div>

      {/* Contador + filtro por vendedor */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {filtered.length === 0
            ? (leads.length === 0 ? 'No hay leads en rescate.' : 'Ningún lead para este filtro.')
            : `${filtered.length} lead${filtered.length !== 1 ? 's' : ''} para rescatar`}
        </div>

        {leads.length > 0 && (
          <Select value={filterVendedor} onValueChange={setFilterVendedor}>
            <SelectTrigger className={cn('h-9 w-auto min-w-[180px] max-w-[260px] text-sm', filterVendedor !== FILTER_ALL && 'border-primary text-primary')}>
              <SelectValue placeholder="Filtrar por vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>Todos los vendedores</SelectItem>
              {haySinAsignar && (
                <SelectItem value={FILTER_SIN}>
                  <span className="text-muted-foreground italic">Sin vendedor asignado</span>
                </SelectItem>
              )}
              {vendedoresEnRescate.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Paginator
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="mb-4"
      />

      {/* Lead cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground border-2 border-dashed rounded-xl">
          {leads.length === 0
            ? '🎉 Ningún lead inactivo. Todo bajo control.'
            : 'No hay leads en rescate de este vendedor.'}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((lead) => (
              <RescueCard
                key={lead.id}
                lead={lead}
                isPending={isPending}
                onView={() => setDetailLead(lead)}
                onReassign={() => setReassignLead(lead)}
                onReactivate={() => handleReactivate(lead.id)}
              />
            ))}
          </div>
          <Paginator
            page={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            className="mt-4"
          />
        </>
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

      {/* Detalle del lead (solo lectura) con acciones de rescate */}
      <RescueDetailSheet
        lead={detailLead}
        onClose={() => setDetailLead(null)}
        onReassign={(l) => setReassignLead(l)}
        onReactivate={(id) => handleReactivate(id)}
        isPending={isPending}
      />
    </div>
  )
}

// ── Lead card ─────────────────────────────────────────────────────

function RescueCard({ lead, isPending, onView, onReassign, onReactivate }: {
  lead:         LeadRow
  isPending:    boolean
  onView:       () => void
  onReassign:   () => void
  onReactivate: () => void
}) {
  const vendorName     = lead.vendedor_alias || lead.vendedor_nombre
  const refDate        = lead.baja_at ?? lead.abandoned_at
  const daysAgo        = refDate
    ? Math.floor((Date.now() - new Date(refDate).getTime()) / 86_400_000)
    : 0
  const formattedValue = formatCurrencyARS(lead.est_value, { compact: true })
  const hasValue       = formattedValue !== '—'
  const enBaja         = isBaja(lead.status)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView() } }}
      className={cn(
        'relative rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow pl-[4px] cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        enBaja ? 'border-rose-200/60' : 'border-amber-200/60',
      )}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-[4px]', enBaja ? 'bg-rose-500/60' : 'bg-amber-500/60')} />
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
            {enBaja && <StatusBadge status={lead.status} />}
          </div>
          {daysAgo > 0 && (
            <span className={cn(
              'text-xs rounded px-2 py-0.5 shrink-0 mt-0.5 border',
              enBaja
                ? 'text-rose-700 bg-rose-50 border-rose-200/60'
                : 'text-amber-700 bg-amber-50 border-amber-200/60',
            )}>
              {enBaja ? 'Dado de baja' : 'Inactivo'} hace {daysAgo} días
            </span>
          )}
        </div>

        {/* Row 2 */}
        <div className="text-xs text-muted-foreground mb-3">
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

        {/* Motivo de baja */}
        {enBaja && lead.baja_motivo && (
          <div className="text-xs text-rose-700/70 bg-rose-50 border border-rose-200/40 rounded-md px-3 py-2 mb-3 italic">
            "{lead.baja_motivo}"
          </div>
        )}


        {/* Row 3 — actions */}
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={(e) => { e.stopPropagation(); onReassign() }}
            disabled={isPending}
          >
            <UserPlus className="size-3.5" />
            Reasignar
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={(e) => { e.stopPropagation(); onReactivate() }}
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
