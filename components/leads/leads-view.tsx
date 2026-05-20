'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import { NewLeadDialog } from '@/components/leads/new-lead-dialog'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, MessageCircle, Phone, ChevronRight, Clock, Target, Plus,
} from 'lucide-react'
import type { Lead } from '@/lib/db'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getMyLeads } from '@/app/actions/leads'

type Vendedor = Awaited<ReturnType<typeof getVendedoresDelTenant>>[number]

type FilterTab = 'Todos' | 'Sin contactar' | 'En seguimiento' | 'En riesgo' | 'Cerrados'
const FILTERS: FilterTab[] = ['Todos', 'Sin contactar', 'En seguimiento', 'En riesgo', 'Cerrados']

interface LeadsViewProps {
  initialLeads: Lead[]
  vendedores: Vendedor[]
  canCreate: boolean
}

export function LeadsView({ initialLeads, vendedores, canCreate }: LeadsViewProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [filter, setFilter] = useState<FilterTab>('Todos')
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [showNewLead, setShowNewLead] = useState(false)

  function refresh() {
    getMyLeads().then(setLeads)
  }

  // ── Derived ──────────────────────────────────────────────────

  const activeLeads  = leads.filter((l) => !['Cerrado', 'Perdido'].includes(l.status))
  const atRiskCount  = leads.filter((l) => l.at_risk).length
  const closedMonth  = leads.filter((l) => l.status === 'Cerrado').length
  const closeRate    = leads.length > 0 ? Math.round((closedMonth / leads.length) * 100) : 0

  const filtered = leads.filter((l) => {
    switch (filter) {
      case 'Sin contactar':  return l.status === 'Nuevo'
      case 'En seguimiento': return ['Contactado', 'Cotizado', 'Test drive', 'Negociación'].includes(l.status)
      case 'En riesgo':      return l.at_risk
      case 'Cerrados':       return l.status === 'Cerrado'
      default:               return true
    }
  })

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
          value={leads.filter((l) => l.status === 'Nuevo').length.toString()}
          sub="requieren atención"
          accent={leads.filter((l) => l.status === 'Nuevo').length > 0 ? 'destructive' : undefined}
        />
        <KpiCard
          icon={<Clock className="size-4 text-destructive" />}
          label="En riesgo ahora"
          value={atRiskCount.toString()}
          sub="sin contacto +24h"
          accent={atRiskCount > 0 ? 'destructive' : undefined}
        />
        <KpiCard
          icon={<Target className="size-4 text-primary" />}
          label="% de cierre"
          value={`${closeRate}%`}
          sub={`${closedMonth} cerrados / ${leads.length} leads`}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-5 border-b border-border">
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
            {f === 'En riesgo' && atRiskCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {atRiskCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lead list */}
      <div className="space-y-3">
        {filtered.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={() => setOpenLeadId(lead.id)} />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No hay leads en esta categoría.
          </div>
        )}
      </div>

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
                <AlertTriangle className="size-3" /> En riesgo
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

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffMin < 2)   return 'Justo ahora'
  if (diffMin < 60)  return `Hace ${diffMin} min`
  if (diffH < 24)    return `Hace ${diffH}h`
  if (diffD === 1)   return 'Ayer'
  return `Hace ${diffD} días`
}
