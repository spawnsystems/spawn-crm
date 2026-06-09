'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Lead } from '@/lib/db'
import { isBaja } from '@/lib/leads/constants'

const ALL = '__all__'

// Accept both Lead and the extended row from getAllLeads (with vendedor fields)
type LeadLike = Lead & { vendedor_nombre?: string | null; vendedor_alias?: string | null }

const STAGES = [
  { id: 'NUEVO',              label: 'Nuevo',              color: 'bg-blue-500'    },
  { id: 'GESTION',            label: 'Gestión',            color: 'bg-slate-500'   },
  { id: 'HORARIO ASIGNADO',   label: 'Horario asignado',   color: 'bg-sky-500'     },
  { id: 'ENTREVISTA PACTADA', label: 'Entrevista pactada', color: 'bg-violet-500'  },
  { id: 'CIERRE',             label: 'Cierre',             color: 'bg-indigo-500'  },
  { id: 'VENTA',              label: 'Venta',              color: 'bg-emerald-500' },
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

  // El board solo muestra estados activos; los de baja viven en /rescate.
  // Es de solo lectura: la etapa avanza con las acciones del lead (llamada,
  // cita, cita realizada, registrar venta), no arrastrando tarjetas.
  const activeLeads  = visibleLeads.filter((l) => !isBaja(l.status))

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vista del embudo · tocá un lead para gestionarlo
          </p>
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
            />
          )
        })}

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

const COLUMN_PAGE_SIZE = 15

interface KanbanColumnProps {
  stage: { id: string; label: string; color: string }
  leads: LeadLike[]
  totalValue: number
  onCardClick: (id: string) => void
}

function KanbanColumn({ stage, leads, totalValue, onCardClick }: KanbanColumnProps) {
  const [visibleCount, setVisibleCount] = useState(COLUMN_PAGE_SIZE)

  // Resetear al colapso mínimo cuando cambia el filtro de vendedor
  useEffect(() => { setVisibleCount(COLUMN_PAGE_SIZE) }, [leads.length])

  const visible  = leads.slice(0, visibleCount)
  const hidden   = leads.length - visibleCount
  const showMore = hidden > 0

  const formattedValue = totalValue >= 1_000_000
    ? `$${(totalValue / 1_000_000).toFixed(1)}M`
    : totalValue > 0
    ? `$${totalValue.toLocaleString('es-AR')}`
    : '—'

  return (
    <div className="w-72 shrink-0 rounded-xl">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', stage.color)} />
          <span className="text-sm font-semibold">{stage.label}</span>
          <span className="text-xs text-muted-foreground">{leads.length}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{formattedValue}</span>
      </div>

      <div className="space-y-2 min-h-[80px]">
        {visible.map((lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onClick={() => onCardClick(lead.id)}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex items-center justify-center rounded-lg border-2 border-dashed min-h-[72px] border-border/30">
            <span className="text-xs text-muted-foreground/35 select-none">
              Sin leads en esta etapa
            </span>
          </div>
        )}
        {showMore && (
          <button
            onClick={() => setVisibleCount((n) => n + COLUMN_PAGE_SIZE)}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
          >
            Ver {Math.min(hidden, COLUMN_PAGE_SIZE)} más de {hidden}
          </button>
        )}
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
      className="p-3 cursor-pointer hover:shadow-elevated transition-shadow"
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
