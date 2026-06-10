'use client'

import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay,
  addMonths, addDays, eachDayOfInterval,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { AppointmentDetailSheet } from '@/components/appointments/appointment-detail-sheet'
import { AppointmentDialog } from '@/components/leads/appointment-dialog'
import { MonthGrid } from '@/components/appointments/calendar/month-grid'
import { TimeGrid } from '@/components/appointments/calendar/time-grid'
import { DayDetailDialog } from '@/components/appointments/calendar/day-detail-dialog'
import { type ApptRow, type CalendarView } from '@/components/appointments/calendar/shared'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Plus, Search,
} from 'lucide-react'
import { getAppointmentsInRange } from '@/app/actions/appointments'
import { getAllLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import {
  appointmentTipoValues, appointmentStatusValues,
  APPOINTMENT_TIPO_LABEL, APPOINTMENT_STATUS_LABEL,
} from '@/lib/schemas/appointments'
import { modeloLabel } from '@/lib/leads/constants'

type LeadRow     = Awaited<ReturnType<typeof getAllLeads>>[number]
type VendedorRow = Awaited<ReturnType<typeof getVendedoresDelTenant>>[number]

const ALL = '__all__'

const VIEW_LABEL: Record<CalendarView, string> = {
  month: 'Mes', week: 'Semana', day: 'Día',
}

// Rango a consultar según la vista (el mes incluye días de semanas vecinas).
function rangeFor(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === 'month') {
    return {
      from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      to:   endOfWeek(endOfMonth(anchor),     { weekStartsOn: 1 }),
    }
  }
  if (view === 'week') {
    return {
      from: startOfWeek(anchor, { weekStartsOn: 1 }),
      to:   endOfWeek(anchor,   { weekStartsOn: 1 }),
    }
  }
  return { from: startOfDay(anchor), to: endOfDay(anchor) }
}

function shiftAnchor(view: CalendarView, anchor: Date, dir: 1 | -1): Date {
  if (view === 'month') return addMonths(anchor, dir)
  if (view === 'week')  return addDays(anchor, dir * 7)
  return addDays(anchor, dir)
}

interface AppointmentsViewProps {
  initialAppointments: ApptRow[]
  vendedores?:         VendedorRow[]
}

export function AppointmentsView({
  initialAppointments, vendedores = [],
}: AppointmentsViewProps) {
  const [view,         setView]         = useState<CalendarView>('month')
  // El ancla se computa en el cliente para evitar el corrimiento de timezone
  // (una Date de "inicio de mes" creada en el server en UTC se interpreta en
  // AR como el mes anterior). Acá siempre arranca en el mes actual local.
  const [anchor,       setAnchor]       = useState(() => startOfMonth(new Date()))
  const [appts,        setAppts]        = useState<ApptRow[]>(initialAppointments)
  const [loading,      setLoading]      = useState(false)

  const [filterTipo,   setFilterTipo]   = useState(ALL)
  const [filterStatus, setFilterStatus] = useState<string>(ALL)
  const [filterVend,   setFilterVend]   = useState(ALL)
  const [showCanceladas, setShowCanceladas] = useState(false)

  const [selectedAppt, setSelectedAppt] = useState<ApptRow | null>(null)
  const [dayDetail,    setDayDetail]    = useState<Date | null>(null)

  // Nueva cita
  const [showLeadSelect, setShowLeadSelect] = useState(false)
  const [leadSearch,     setLeadSearch]     = useState('')
  const [leads,          setLeads]          = useState<LeadRow[]>([])
  const [loadingLeads,   setLoadingLeads]   = useState(false)
  const [selectedLead,   setSelectedLead]   = useState<LeadRow | null>(null)
  const [showApptDialog, setShowApptDialog] = useState(false)

  // ── Carga ──────────────────────────────────────────────────────
  async function load(
    v:      CalendarView,
    a:      Date,
    vend:   string  = filterVend,
    cancel: boolean = showCanceladas,
  ) {
    setView(v)
    setAnchor(a)
    setLoading(true)
    const { from, to } = rangeFor(v, a)
    try {
      const res = await getAppointmentsInRange(from, to, {
        includeCancelled: cancel,
        vendedorId:       vend !== ALL ? vend : undefined,
      })
      setAppts(res)
    } catch {
      toast.error('No se pudieron cargar las citas')
    } finally {
      setLoading(false)
    }
  }

  function refresh() { return load(view, anchor) }

  // ── Filtro cliente (tipo / estado) ─────────────────────────────
  const filtered = useMemo(() => appts.filter((a) => {
    if (filterTipo   !== ALL && a.tipo   !== filterTipo)   return false
    if (filterStatus !== ALL && a.status !== filterStatus) return false
    if (!showCanceladas && a.status === 'cancelada')        return false
    return true
  }), [appts, filterTipo, filterStatus, showCanceladas])

  // Días para las vistas de grilla horaria
  const gridDays = useMemo(() => {
    if (view === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(anchor, { weekStartsOn: 1 }),
        end:   endOfWeek(anchor,   { weekStartsOn: 1 }),
      })
    }
    if (view === 'day') return [anchor]
    return []
  }, [view, anchor])

  // Título según vista
  const title = useMemo(() => {
    if (view === 'month') return format(anchor, 'MMMM yyyy', { locale: es })
    if (view === 'day')   return format(anchor, "EEEE d 'de' MMMM", { locale: es })
    const ws = startOfWeek(anchor, { weekStartsOn: 1 })
    const we = endOfWeek(anchor,   { weekStartsOn: 1 })
    return `${format(ws, 'd MMM', { locale: es })} – ${format(we, 'd MMM yyyy', { locale: es })}`
  }, [view, anchor])

  // ── Nueva cita ─────────────────────────────────────────────────
  async function handleOpenLeadSelect() {
    setLeadSearch('')
    setShowLeadSelect(true)
    if (leads.length === 0) {
      setLoadingLeads(true)
      try {
        setLeads(await getAllLeads())
      } catch {
        toast.error('No se pudo cargar la lista de leads')
      } finally {
        setLoadingLeads(false)
      }
    }
  }

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads.slice(0, 25)
    const q = leadSearch.toLowerCase()
    return leads.filter((l) =>
      l.nombre.toLowerCase().includes(q) || (l.modelo ?? '').toLowerCase().includes(q),
    ).slice(0, 25)
  }, [leads, leadSearch])

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
          <span className="text-sm text-muted-foreground capitalize">{title}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Hoy + navegación */}
          <Button size="sm" variant="outline" className="h-9" onClick={() => load(view, new Date())} disabled={loading}>
            Hoy
          </Button>
          <div className="flex items-center gap-0.5 rounded-lg border border-border px-1 py-0.5">
            <Button size="icon" variant="ghost" className="size-8" disabled={loading}
              onClick={() => load(view, shiftAnchor(view, anchor, -1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" disabled={loading}
              onClick={() => load(view, shiftAnchor(view, anchor, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Switcher de vista */}
          <div className="flex items-center rounded-lg border border-border p-0.5">
            {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => load(v, anchor)}
                className={cn(
                  'px-3 h-8 rounded-md text-sm font-medium transition-colors',
                  view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>

          <Button size="sm" className="h-9 gap-1.5" onClick={handleOpenLeadSelect}>
            <Plus className="size-3.5" />Nueva cita
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {vendedores.length > 0 && (
          <Select value={filterVend} onValueChange={(v) => { setFilterVend(v); void load(view, anchor, v, showCanceladas) }}>
            <SelectTrigger className={cn('h-9 w-auto min-w-[130px] max-w-[240px] text-sm', filterVend !== ALL && 'border-primary text-primary')}>
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los vendedores</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.user_id} value={v.user_id}>{v.alias || v.nombre || v.user_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className={cn('h-9 w-auto min-w-[120px] max-w-[220px] text-sm', filterTipo !== ALL && 'border-primary text-primary')}>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {appointmentTipoValues.map((t) => (
              <SelectItem key={t} value={t}>{APPOINTMENT_TIPO_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className={cn('h-9 w-auto min-w-[120px] max-w-[220px] text-sm', filterStatus !== ALL && 'border-primary text-primary')}>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {appointmentStatusValues
              .filter((s) => showCanceladas || s !== 'cancelada')
              .map((s) => <SelectItem key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant={showCanceladas ? 'secondary' : 'ghost'}
          className="h-9 text-xs"
          onClick={() => { const n = !showCanceladas; setShowCanceladas(n); void load(view, anchor, filterVend, n) }}
        >
          {showCanceladas ? 'Ocultar canceladas' : 'Mostrar canceladas'}
        </Button>

        {/* Leyenda de tipos */}
        <div className="ml-auto hidden md:flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-emerald-600" />Cierre</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-violet-500" />Visita</span>
          <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-sky-500" />Videollamada</span>
        </div>
      </div>

      {/* Calendario */}
      <div className={cn('transition-opacity', loading && 'opacity-50 pointer-events-none')}>
        {view === 'month' ? (
          <MonthGrid
            anchor={anchor}
            appts={filtered}
            onApptClick={setSelectedAppt}
            onMore={(d) => setDayDetail(d)}
            onDayClick={(d) => load('day', d)}
          />
        ) : (
          <TimeGrid days={gridDays} appts={filtered} onApptClick={setSelectedAppt} />
        )}
      </div>

      {/* Detalle de cita */}
      <AppointmentDetailSheet
        appointment={selectedAppt}
        onClose={() => setSelectedAppt(null)}
        onUpdated={refresh}
      />

      {/* Detalle del día (+N más) */}
      <DayDetailDialog
        date={dayDetail}
        appts={filtered}
        onClose={() => setDayDetail(null)}
        onApptClick={(a) => { setDayDetail(null); setSelectedAppt(a) }}
      />

      {/* Nueva cita — paso 1: elegir lead */}
      <Dialog open={showLeadSelect} onOpenChange={(v) => { if (!v) { setShowLeadSelect(false); setLeadSearch('') } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Elegir lead para la cita</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar lead por nombre o modelo..."
                className="pl-8 h-9 text-sm"
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                autoFocus
              />
            </div>
            {loadingLeads ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Cargando leads...</div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-0.5 -mx-1">
                {filteredLeads.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => { setSelectedLead(l); setShowLeadSelect(false); setShowApptDialog(true) }}
                    className="w-full text-left rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <div className="text-sm font-medium">{l.nombre}</div>
                    <div className="text-xs text-muted-foreground">{modeloLabel(l.modelo)} · {l.status}</div>
                  </button>
                ))}
                {filteredLeads.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No se encontraron leads.</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Nueva cita — paso 2 */}
      {selectedLead && (
        <AppointmentDialog
          open={showApptDialog}
          onOpenChange={(v) => { if (!v) { setShowApptDialog(false); setSelectedLead(null) } }}
          leadId={selectedLead.id}
          leadNombre={selectedLead.nombre}
          defaultModelo={selectedLead.modelo}
          onCreated={() => { setShowApptDialog(false); setSelectedLead(null); void refresh() }}
        />
      )}
    </div>
  )
}
