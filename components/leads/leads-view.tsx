'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import { NewLeadDialog } from '@/components/leads/new-lead-dialog'
import { Paginator } from '@/components/ui/paginator'
import { cn, formatRelative, safeRefetch } from '@/lib/utils'
import {
  AlertTriangle, MessageCircle, Phone, ChevronRight, Clock, Target, Plus,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import type { Lead } from '@/lib/db'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getMyLeads } from '@/app/actions/leads'
import { STATUS_ORDER, isBaja } from '@/lib/leads/constants'

type Vendedor = Awaited<ReturnType<typeof getVendedoresDelTenant>>[number]

type FilterTab = 'Todos' | 'Sin contactar' | 'En seguimiento' | 'Demorados'
const FILTERS: FilterTab[] = ['Todos', 'Sin contactar', 'En seguimiento', 'Demorados']

type SortKey = 'last_contact_at' | 'status'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

interface LeadsViewProps {
  initialLeads: Lead[]
  vendedores: Vendedor[]
  modelos: string[]
  canCreate: boolean
}

export function LeadsView({ initialLeads, vendedores, modelos, canCreate }: LeadsViewProps) {
  const [leads,       setLeads]       = useState<Lead[]>(initialLeads)
  const [filter,      setFilter]      = useState<FilterTab>('Todos')
  const [openLeadId,  setOpenLeadId]  = useState<string | null>(null)
  const [showNewLead, setShowNewLead] = useState(false)
  const [sortKey,     setSortKey]     = useState<SortKey>('last_contact_at')
  const [sortDir,     setSortDir]     = useState<SortDir>('asc')
  const [page,        setPage]        = useState(1)

  function refresh() {
    void safeRefetch(() => getMyLeads(), 'No se pudieron actualizar tus leads')
      .then((next) => { if (next) setLeads(next) })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // ── Derived ──────────────────────────────────────────────────

  const activeLeads = leads.filter((l) => !isBaja(l.status) && l.status !== 'VENTA')
  const atRiskCount = leads.filter((l) => l.at_risk).length
  const closedMonth = leads.filter((l) => l.status === 'VENTA').length
  const closeRate   = leads.length > 0 ? Math.round((closedMonth / leads.length) * 100) : 0

  const filtered = useMemo(() => {
    const base = leads.filter((l) => {
      // Mis Leads siempre muestra solo activos — bajas y ventas van a /historial
      const esActivo = !isBaja(l.status) && l.status !== 'VENTA'
      if (!esActivo) return false
      switch (filter) {
        case 'Sin contactar':  return l.status === 'GESTION' && !l.last_contact_at
        case 'En seguimiento': return ['GESTION', 'HORARIO ASIGNADO', 'ENTREVISTA PACTADA', 'CIERRE'].includes(l.status)
        case 'Demorados':      return l.at_risk
        default:               return true
      }
    })

    return base.sort((a, b) => {
      if (sortKey === 'status') {
        const cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
        return sortDir === 'asc' ? cmp : -cmp
      }
      // last_contact_at: null (sin contactar) primero en ASC
      const aTime = a.last_contact_at ? new Date(a.last_contact_at).getTime() : null
      const bTime = b.last_contact_at ? new Date(b.last_contact_at).getTime() : null
      if (aTime === null && bTime === null) return 0
      if (aTime === null) return sortDir === 'asc' ? -1 : 1
      if (bTime === null) return sortDir === 'asc' ? 1 : -1
      const cmp = aTime - bTime
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, filter, sortKey, sortDir])

  // Reset a página 1 cuando cambia filtro o sort
  useEffect(() => { setPage(1) }, [filter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeLeads.length} leads activos
          </p>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewLead(true)}>
            <Plus className="size-3.5" />Nuevo Lead
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={<AlertTriangle className="size-4 text-destructive" />}
          label="Sin contactar"
          value={leads.filter((l) => !l.last_contact_at && !isBaja(l.status) && l.status !== 'VENTA').length.toString()}
          sub="requieren atención"
          accent={leads.filter((l) => !l.last_contact_at && !isBaja(l.status) && l.status !== 'VENTA').length > 0 ? 'destructive' : undefined}
        />
        <KpiCard
          icon={<Clock className="size-4 text-destructive" />}
          label="Demorados"
          value={atRiskCount.toString()}
          sub="superaron el SLA de contacto"
          accent={atRiskCount > 0 ? 'destructive' : undefined}
        />
        <KpiCard
          icon={<Target className="size-4 text-primary" />}
          label="% de cierre"
          value={`${closeRate}%`}
          sub={`${closedMonth} ventas / ${leads.length} leads`}
        />
      </div>

      {/* Filter tabs + sort controls */}
      <div className="flex items-center justify-between border-b border-border mb-5">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                filter === f
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {f}
              {f === 'Demorados' && atRiskCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {atRiskCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-0.5 pb-px">
          <span className="text-xs text-muted-foreground mr-1.5">Ordenar:</span>
          <SortButton label="Último contacto" col="last_contact_at" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
          <SortButton label="Estado"          col="status"          sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
        </div>
      </div>

      <Paginator
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="mb-4"
      />

      {/* Lead list */}
      <div className="space-y-3">
        {paginated.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={() => setOpenLeadId(lead.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No hay leads en esta categoría.
          </div>
        )}
      </div>

      <Paginator
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="mt-5"
      />

      {/* Lead detail sheet */}
      <LeadDetailSheet
        leadId={openLeadId}
        onClose={() => { setOpenLeadId(null); refresh() }}
        onStatusChange={(id, status) =>
          setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: status as Lead['status'] } : l))
        }
      />

      {/* New lead dialog */}
      <NewLeadDialog
        open={showNewLead}
        onOpenChange={setShowNewLead}
        vendedores={vendedores}
        modelos={modelos}
        onCreated={refresh}
      />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: React.ReactNode
  accent?: 'destructive'
}) {
  return (
    <Card className={cn('p-5', accent === 'destructive' && 'border-destructive/20 bg-destructive-soft/40')}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        {icon}
      </div>
      <div className={cn('mt-3 text-3xl font-semibold tracking-tight', accent === 'destructive' && 'text-destructive')}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </Card>
  )
}

// ── Sort button ───────────────────────────────────────────────

function SortButton({
  label, col, sortKey, sortDir, onToggle,
}: {
  label:    string
  col:      SortKey
  sortKey:  SortKey
  sortDir:  SortDir
  onToggle: (col: SortKey) => void
}) {
  const active = sortKey === col
  return (
    <button
      onClick={() => onToggle(col)}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
        active
          ? 'bg-primary/8 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
      )}
    >
      {label}
      {active && (
        sortDir === 'asc'
          ? <ArrowUp   className="size-3" />
          : <ArrowDown className="size-3" />
      )}
    </button>
  )
}

// ── Lead card ─────────────────────────────────────────────────

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const lastContact = lead.last_contact_at
    ? formatRelative(new Date(lead.last_contact_at))
    : 'Sin contactar'

  return (
    <Card
      onClick={onOpen}
      className={cn(
        'group relative overflow-hidden p-0 cursor-pointer transition-all hover:shadow-elevated',
        lead.at_risk && 'border-l-0',
      )}
    >
      {lead.at_risk && <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />}
      <div className="p-5 pl-6 flex items-center gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold text-base">{lead.nombre}</h3>
            <StatusBadge status={lead.status} />
            {lead.at_risk && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive bg-destructive-soft px-2 py-0.5 rounded-full border border-destructive/20">
                <AlertTriangle className="size-3" /> Demorado
              </span>
            )}
          </div>
          <div className="mt-1.5 text-sm text-muted-foreground">
            <span className="text-foreground/80 font-medium">{lead.modelo ?? '—'}</span>
            <span className="mx-2">·</span>
            <span>{lead.source}</span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className={cn('inline-flex items-center gap-1', lead.last_contact_critical ? 'text-destructive font-medium' : 'text-muted-foreground')}>
              <Clock className="size-3" />
              {lastContact}
            </span>
            {lead.next_action && (
              <span className="text-muted-foreground">
                Próxima acción: <span className="text-foreground font-medium">{lead.next_action}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {lead.telefono && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
              <a href={`https://wa.me/${lead.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-3.5 text-success" />WhatsApp
              </a>
            </Button>
          )}
          {lead.telefono && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
              <a href={`tel:${lead.telefono}`}>
                <Phone className="size-3.5" />Llamar
              </a>
            </Button>
          )}
          <Button size="sm" onClick={onOpen} className="h-8 gap-1">
            Ver ficha <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

