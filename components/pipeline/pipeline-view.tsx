'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { LifeBuoy } from 'lucide-react'
import type { Lead } from '@/lib/db'
import { changeStatus } from '@/app/actions/leads'
import { toast } from 'sonner'

const ALL = '__all__'

// Accept both Lead and the extended row from getAllLeads (with vendedor fields)
type LeadLike = Lead & { vendedor_nombre?: string | null; vendedor_alias?: string | null }

const STAGES = [
  { id: 'Nuevo',      label: 'Nuevos',      color: 'bg-slate-500'   },
  { id: 'Contactado', label: 'Contactados', color: 'bg-blue-500'    },
  { id: 'Citado',     label: 'Citados',     color: 'bg-violet-500'  },
  { id: 'Cerrado',    label: 'Cerrados',    color: 'bg-emerald-500' },
] as const

interface PipelineViewProps {
  initialLeads: LeadLike[]
}

export function PipelineView({ initialLeads }: PipelineViewProps) {
  const [leads,       setLeads]       = useState<LeadLike[]>(initialLeads)
  const [openLeadId,  setOpenLeadId]  = useState<string | null>(null)
  const [filterVend,  setFilterVend]  = useState(ALL)

  // Derive unique vendedores from the leads list (no extra fetch needed)
  const vendedores = useMemo(() => {
    const map = new Map<string, string>()
    leads.forEach((l) => {
      if (l.assigned_to && (l.vendedor_nombre || l.vendedor_alias)) {
        map.set(l.assigned_to, l.vendedor_alias || l.vendedor_nombre || l.assigned_to)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [leads])

  const visibleLeads = useMemo(() =>
    filterVend === ALL ? leads : leads.filter((l) => l.assigned_to === filterVend),
    [leads, filterVend],
  )

  const activeLeads  = visibleLeads.filter((l) => l.status !== 'Para rescate')
  const rescueLeads  = visibleLeads.filter((l) => l.status === 'Para rescate')

  async function handleDrop(leadId: string, newStatus: LeadLike['status']) {
    const prev = leads.find((l) => l.id === leadId)?.status
    if (prev === newStatus) return

    // Optimistic update
    setLeads((ls) => ls.map((l) => l.id === leadId ? { ...l, status: newStatus } : l))

    const res = await changeStatus(leadId, newStatus)
    if (!res.success) {
      // Rollback
      setLeads((ls) => ls.map((l) => l.id === leadId ? { ...l, status: prev! } : l))
      toast.error(res.error)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Vista Kanban de tu embudo de ventas</p>
        </div>
        {vendedores.length > 1 && (
          <Select value={filterVend} onValueChange={setFilterVend}>
            <SelectTrigger className={cn('h-9 w-48 text-sm', filterVend !== ALL && 'border-primary text-primary')}>
              <SelectValue placeholder="Todos los vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los vendedores</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {STAGES.map((stage) => {
          const items = activeLeads.filter((l) => l.status === stage.id)
          const total = items.reduce((acc, l) => acc + (parseFloat(l.est_value ?? '0') || 0), 0)

          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={items}
              totalValue={total}
              onCardClick={setOpenLeadId}
              onDrop={(leadId) => handleDrop(leadId, stage.id as LeadLike['status'])}
            />
          )
        })}

        {/* Para rescate — columna apartada visualmente con borde ámbar */}
        <div
          className={cn(
            'w-64 shrink-0 rounded-xl border-l-2 border-amber-400/60 pl-3 bg-amber-50/30',
          )}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const leadId = e.dataTransfer.getData('leadId')
            if (leadId) handleDrop(leadId, 'Para rescate' as LeadLike['status'])
          }}
        >
          <div className="flex items-center justify-between mb-3 px-1 pt-1">
            <div className="flex items-center gap-2">
              <LifeBuoy className="size-3.5 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">Para rescate</span>
              <span className="text-xs text-amber-700/70">{rescueLeads.length}</span>
            </div>
          </div>
          <div className="space-y-2 min-h-[80px]">
            {rescueLeads.map((lead) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                onClick={() => setOpenLeadId(lead.id)}
              />
            ))}
            {rescueLeads.length === 0 && (
              <p className="text-xs text-amber-700/50 italic px-1 py-3">
                Sin leads inactivos.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mt-4">
        {visibleLeads.length !== leads.length
          ? `${visibleLeads.length} de ${leads.length} leads`
          : `${leads.length} leads totales`}
      </div>

      <LeadDetailSheet
        leadId={openLeadId}
        onClose={() => setOpenLeadId(null)}
        onStatusChange={(id, status) =>
          setLeads((ls) => ls.map((l) => l.id === id ? { ...l, status: status as LeadLike['status'] } : l))
        }
      />
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: { id: string; label: string; color: string }
  leads: LeadLike[]
  totalValue: number
  onCardClick: (id: string) => void
  onDrop: (leadId: string) => void
}

function KanbanColumn({ stage, leads, totalValue, onCardClick, onDrop }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const formattedValue = totalValue >= 1_000_000
    ? `$${(totalValue / 1_000_000).toFixed(1)}M`
    : totalValue > 0
    ? `$${totalValue.toLocaleString('es-AR')}`
    : '—'

  return (
    <div
      className={cn(
        'w-72 shrink-0 rounded-xl transition-colors',
        isDragOver && 'bg-primary/5 ring-2 ring-primary/20',
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        const leadId = e.dataTransfer.getData('leadId')
        if (leadId) onDrop(leadId)
      }}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', stage.color)} />
          <span className="text-sm font-semibold">{stage.label}</span>
          <span className="text-xs text-muted-foreground">{leads.length}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{formattedValue}</span>
      </div>

      <div className="space-y-2 min-h-[80px]">
        {leads.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onClick={() => onCardClick(lead.id)}
          />
        ))}
      </div>
    </div>
  )
}

function KanbanCard({ lead, onClick }: { lead: LeadLike; onClick: () => void }) {
  const value = parseFloat(lead.est_value ?? '0')
  const formattedValue = value >= 1_000_000
    ? `$${(value / 1_000_000).toFixed(1)}M`
    : value > 0
    ? `$${value.toLocaleString('es-AR')}`
    : null

  return (
    <Card
      draggable
      onDragStart={(e) => e.dataTransfer.setData('leadId', lead.id)}
      className="p-3 cursor-grab active:cursor-grabbing hover:shadow-elevated transition-shadow"
      onClick={onClick}
    >
      <div className="text-sm font-medium">{lead.nombre}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{lead.modelo ?? '—'}</div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        {formattedValue ? (
          <span className="font-semibold text-primary">{formattedValue}</span>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">{lead.days_in_stage ?? 0}d en etapa</span>
      </div>
      {(lead.vendedor_alias || lead.vendedor_nombre) && (
        <div className="mt-1 text-[10px] text-muted-foreground/70 truncate">
          {lead.vendedor_alias || lead.vendedor_nombre}
        </div>
      )}
    </Card>
  )
}
