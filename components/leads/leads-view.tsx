'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import { NewLeadDialog } from '@/components/leads/new-lead-dialog'
import { Paginator } from '@/components/ui/paginator'
import { cn, formatRelative, safeRefetch, toBADate, formatCurrencyARS } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AlertTriangle, MessageCircle, Phone, ChevronRight, Clock, Target, Plus,
  ArrowUp, ArrowDown, CalendarCheck, PhoneCall, Car, Search,
} from 'lucide-react'
import type { Lead } from '@/lib/db'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { getMyLeads } from '@/app/actions/leads'
import { STATUS_ORDER, isBaja, sourceLabel, modeloLabel } from '@/lib/leads/constants'
import { APPOINTMENT_TIPO_LABEL, type AppointmentTipo } from '@/lib/schemas/appointments'

type Vendedor = Awaited<ReturnType<typeof getVendedoresDelTenant>>[number]

type FilterTab = 'Todos' | 'Sin contactar' | 'Colgados' | 'Requieren atención' | 'En gestión'
const FILTERS: FilterTab[] = ['Todos', 'Sin contactar', 'Colgados', 'Requieren atención', 'En gestión']

// Lead enriquecido con los campos de atención que devuelve getMyLeads.
type MyLead = Awaited<ReturnType<typeof getMyLeads>>[number]

type SortKey = 'last_contact_at' | 'status'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

interface LeadsViewProps {
  initialLeads: MyLead[]
  vendedores: Vendedor[]
  modelos: string[]
  customSources?: string[]
  canCreate: boolean
}

export function LeadsView({ initialLeads, vendedores, modelos, customSources = [], canCreate }: LeadsViewProps) {
  const [leads,       setLeads]       = useState<MyLead[]>(initialLeads)
  const [search,      setSearch]      = useState('')
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
  // Dos lentes independientes (ver lib/leads/attention.ts):
  //   sin contactar = alcance: nunca se logró un contacto efectivo.
  //   colgado       = momentum: ya contactado pero sin próximo paso agendado.
  const sinContactarCount   = leads.filter((l) => l.sin_contactar).length
  // Subconjunto urgente de "sin contactar": pasó el plazo de 1er contacto y
  // no tiene reintento agendado (lo marca el motor como attention_type).
  const sinContactarVencido = leads.filter((l) => l.attention_type === 'sin_contactar').length
  const colgadoCount        = leads.filter((l) => l.colgado).length
  const gestionCount        = leads.filter((l) => l.status === 'GESTION').length
  const closedMonth = leads.filter((l) => l.status === 'VENTA').length
  const closeRate   = leads.length > 0 ? Math.round((closedMonth / leads.length) * 100) : 0

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = leads.filter((l) => {
      // Mis Leads siempre muestra solo activos — bajas y ventas van a /historial
      const esActivo = !isBaja(l.status) && l.status !== 'VENTA'
      if (!esActivo) return false

      // Buscador: nombre, modelo, origen, contacto y ubicación
      if (q) {
        const matches =
          l.nombre.toLowerCase().includes(q) ||
          (l.modelo ?? '').toLowerCase().includes(q) ||
          sourceLabel(l.source, l.source_custom).toLowerCase().includes(q) ||
          (l.telefono ?? '').includes(q) ||
          (l.email ?? '').toLowerCase().includes(q) ||
          (l.localidad ?? '').toLowerCase().includes(q) ||
          (l.provincia ?? '').toLowerCase().includes(q) ||
          (l.usado_marca ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }

      switch (filter) {
        case 'Sin contactar':      return l.sin_contactar
        case 'Colgados':           return l.colgado
        case 'Requieren atención': return l.at_risk
        case 'En gestión':         return l.status === 'GESTION'
        default:                   return true
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
  }, [leads, search, filter, sortKey, sortDir])

  // Reset a página 1 cuando cambia búsqueda, filtro o sort
  useEffect(() => { setPage(1) }, [search, filter, sortKey, sortDir])

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
          value={sinContactarCount.toString()}
          sub={sinContactarVencido > 0
            ? `${sinContactarVencido} pasaron el plazo de 1er contacto`
            : 'todos en plazo o con reintento'}
          accent={sinContactarVencido > 0 ? 'destructive' : undefined}
        />
        <KpiCard
          icon={<Clock className="size-4 text-destructive" />}
          label="Colgados"
          value={colgadoCount.toString()}
          sub="contactados, sin próximo paso"
          accent={colgadoCount > 0 ? 'destructive' : undefined}
        />
        <KpiCard
          icon={<Target className="size-4 text-primary" />}
          label="% de cierre"
          value={`${closeRate}%`}
          sub={`${closedMonth} ventas / ${leads.length} leads`}
        />
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar nombre, modelo, teléfono, email..."
          className="pl-8 h-9 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
              {f === 'Requieren atención' && atRiskCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {atRiskCount}
                </span>
              )}
              {f === 'En gestión' && gestionCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                  {gestionCount}
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
            {search.trim()
              ? `Sin resultados para "${search.trim()}".`
              : 'No hay leads en esta categoría.'}
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
        onLeadsRefresh={refresh}
      />

      {/* New lead dialog */}
      <NewLeadDialog
        open={showNewLead}
        onOpenChange={setShowNewLead}
        vendedores={vendedores}
        modelos={modelos}
        customSources={customSources}
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

// ── Próximo paso derivado ─────────────────────────────────────
// Se calcula a partir del estado real del lead (cita programada,
// llamada pendiente) y cae al texto libre next_action como último
// recurso. Es la "próxima acción" auto-generada que ve el vendedor.

type NextStepTone = 'appt' | 'call' | 'callOverdue' | 'text'

interface NextStep {
  Icon:    React.FC<{ className?: string }>
  label:   string
  when:    Date | null
  overdue: boolean
  tone:    NextStepTone
}

function deriveNextStep(lead: MyLead): NextStep | null {
  // 1) Cita programada — máxima prioridad
  if (lead.open_appt_at) {
    const tipo = lead.open_appt_tipo
      ? APPOINTMENT_TIPO_LABEL[lead.open_appt_tipo as AppointmentTipo] ?? null
      : null
    const when = new Date(lead.open_appt_at)
    return {
      Icon:    CalendarCheck,
      label:   tipo ? `Cita · ${tipo}` : 'Cita agendada',
      when,
      overdue: when.getTime() < Date.now(),
      tone:    'appt',
    }
  }
  // 2) Llamada pendiente
  if (lead.pending_call_at) {
    const when    = new Date(lead.pending_call_at)
    const overdue = when.getTime() < Date.now()
    return {
      Icon:    PhoneCall,
      label:   'Llamada agendada',
      when,
      overdue,
      tone:    overdue ? 'callOverdue' : 'call',
    }
  }
  // 3) Texto libre de próxima acción
  if (lead.next_action) {
    return { Icon: Target, label: lead.next_action, when: null, overdue: false, tone: 'text' }
  }
  return null
}

const NEXT_STEP_TONE: Record<NextStepTone, string> = {
  appt:        'text-violet-700 bg-violet-50 border-violet-200/70',
  call:        'text-sky-700 bg-sky-50 border-sky-200/70',
  callOverdue: 'text-destructive bg-destructive-soft border-destructive/20',
  text:        'text-muted-foreground bg-muted/50 border-border',
}

function fmtNextStepWhen(d: Date): string {
  return format(toBADate(d), "EEE d 'a las' HH:mm", { locale: es })
}

// ── Badge de usado en parte de pago ───────────────────────────
// Muestra el valor de toma si ya se cotizó, "rechazado" si fue rechazado,
// o "s/cotizar" si tiene usado pero todavía no hay cotización.

// El subquery puede devolver el booleano como string ("true"/"false"/"t"/"f")
// según el driver; normalizamos para no romper la lógica del badge.
function coerceBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 't'
}

function UsadoBadge({ lead }: { lead: MyLead }) {
  const rechazado  = coerceBool(lead.usado_rechazado)
  const tieneValor = lead.usado_valor != null && !rechazado
  const marca      = lead.usado_marca ?? null
  const prefix     = marca ?? 'Usado'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        rechazado
          ? 'text-rose-700 bg-rose-50 border-rose-200/70'
          : tieneValor
          ? 'text-amber-800 bg-amber-50 border-amber-200/70'
          : 'text-muted-foreground bg-muted/50 border-border',
      )}
      title="Usado en parte de pago"
    >
      <Car className="size-3 shrink-0" />
      {rechazado
        ? `${prefix} · rechazado`
        : tieneValor
        ? `${prefix} · ${formatCurrencyARS(lead.usado_valor as string)}`
        : `${prefix} · s/cotizar`}
    </span>
  )
}

// ── Lead card ─────────────────────────────────────────────────

function LeadCard({ lead, onOpen }: { lead: MyLead; onOpen: () => void }) {
  const lastContact = lead.last_contact_at
    ? formatRelative(new Date(lead.last_contact_at))
    : 'Sin contactar'

  const alta     = lead.attention_severity === 'alta'
  const nextStep = deriveNextStep(lead)

  return (
    <Card
      onClick={onOpen}
      className={cn(
        'group relative overflow-hidden p-0 cursor-pointer transition-all hover:shadow-elevated',
        lead.at_risk && 'border-l-0',
      )}
    >
      {lead.at_risk && (
        <div className={cn('absolute left-0 top-0 bottom-0 w-1', alta ? 'bg-destructive' : 'bg-amber-500')} />
      )}
      <div className="p-5 pl-6 flex items-center gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold text-base">{lead.nombre}</h3>
            <StatusBadge status={lead.status} />
            {lead.at_risk && lead.attention_reason && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
                  alta
                    ? 'text-destructive bg-destructive-soft border-destructive/20'
                    : 'text-amber-700 bg-amber-50 border-amber-200/70',
                )}
                title={lead.attention_detail ?? undefined}
              >
                <AlertTriangle className="size-3" />
                {lead.attention_reason}
                {lead.attention_detail && (
                  <span className="font-normal opacity-70">· {lead.attention_detail}</span>
                )}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span>
              <span className="text-foreground/80 font-medium">{modeloLabel(lead.modelo)}</span>
              <span className="mx-2">·</span>
              <span>{sourceLabel(lead.source, lead.source_custom)}</span>
            </span>
            {(lead.tiene_usado || lead.usado_valor != null) && <UsadoBadge lead={lead} />}
          </div>
          <div className="mt-2.5 flex items-center gap-2.5 flex-wrap text-xs">
            <span className={cn('inline-flex items-center gap-1', lead.last_contact_critical ? 'text-destructive font-medium' : 'text-muted-foreground')}>
              <Clock className="size-3" />
              {lastContact}
            </span>

            {/* Próximo paso derivado (cita / llamada / texto libre) */}
            {nextStep && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium max-w-[22rem]',
                  NEXT_STEP_TONE[nextStep.tone],
                )}
                title={nextStep.when ? fmtNextStepWhen(nextStep.when) : nextStep.label}
              >
                <nextStep.Icon className="size-3 shrink-0" />
                <span className="truncate">{nextStep.label}</span>
                {nextStep.when && (
                  <span className="font-normal opacity-80 whitespace-nowrap">
                    · {fmtNextStepWhen(nextStep.when)}
                  </span>
                )}
                {nextStep.overdue && (
                  <span className="font-semibold uppercase tracking-wide text-[10px]">· Vencida</span>
                )}
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

