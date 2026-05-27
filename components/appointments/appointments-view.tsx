'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from 'date-fns'
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
import { cn } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Plus, Search, CalendarCheck,
} from 'lucide-react'
import { getAppointmentsInRange } from '@/app/actions/appointments'
import { getAllLeads } from '@/app/actions/leads'
import {
  appointmentTipoValues,
  appointmentStatusValues,
  APPOINTMENT_TIPO_LABEL,
  APPOINTMENT_STATUS_LABEL,
} from '@/lib/schemas/appointments'

// ── Types ─────────────────────────────────────────────────────────

type ApptRow = Awaited<ReturnType<typeof getAppointmentsInRange>>[number]
type LeadRow = Awaited<ReturnType<typeof getAllLeads>>[number]

const ALL = '__all__'

// ── Props ─────────────────────────────────────────────────────────

interface AppointmentsViewProps {
  initialAppointments: ApptRow[]
  initialMonth:        Date
}

// ── Component ─────────────────────────────────────────────────────

export function AppointmentsView({ initialAppointments, initialMonth }: AppointmentsViewProps) {
  const [month,           setMonth]           = useState(initialMonth)
  const [appointments,    setAppointments]     = useState<ApptRow[]>(initialAppointments)
  const [filterTipo,      setFilterTipo]       = useState(ALL)
  const [filterStatus,    setFilterStatus]     = useState<string>('programada')
  const [showCanceladas,  setShowCanceladas]   = useState(false)
  const [selectedAppt,    setSelectedAppt]     = useState<ApptRow | null>(null)

  // Nueva cita flow — step 1: select lead
  const [showLeadSelect,  setShowLeadSelect]   = useState(false)
  const [leadSearch,      setLeadSearch]       = useState('')
  const [leads,           setLeads]            = useState<LeadRow[]>([])
  const [loadingLeads,    setLoadingLeads]      = useState(false)

  // Nueva cita flow — step 2: appointment dialog
  const [selectedLead,    setSelectedLead]     = useState<LeadRow | null>(null)
  const [showApptDialog,  setShowApptDialog]   = useState(false)

  // ── Helpers ──────────────────────────────────────────────────

  async function fetchMonth(newMonth: Date, includeCancelled = showCanceladas) {
    setMonth(newMonth)
    const from = startOfMonth(newMonth)
    const to   = endOfMonth(newMonth)
    try {
      const res = await getAppointmentsInRange(from, to, { includeCancelled })
      setAppointments(res)
    } catch {
      toast.error('No se pudieron cargar las citas')
    }
  }

  async function refresh() {
    await fetchMonth(month)
  }

  async function handleOpenLeadSelect() {
    setLeadSearch('')
    setShowLeadSelect(true)
    if (leads.length === 0) {
      setLoadingLeads(true)
      try {
        const all = await getAllLeads()
        setLeads(all)
      } catch {
        toast.error('No se pudo cargar la lista de leads')
      } finally {
        setLoadingLeads(false)
      }
    }
  }

  // ── Derived ──────────────────────────────────────────────────

  const filtered = useMemo(() => appointments.filter((a) => {
    if (filterTipo !== ALL && a.tipo !== filterTipo) return false
    if (!showCanceladas && a.status === 'cancelada') return false
    if (filterStatus !== ALL && a.status !== filterStatus) return false
    return true
  }), [appointments, filterTipo, filterStatus, showCanceladas])

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, ApptRow[]>()
    for (const a of filtered) {
      const key = format(new Date(a.scheduled_at), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ date: new Date(`${key}T12:00:00`), items }))
  }, [filtered])

  // Lead search
  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads.slice(0, 25)
    const q = leadSearch.toLowerCase()
    return leads.filter((l) =>
      l.nombre.toLowerCase().includes(q) ||
      (l.modelo ?? '').toLowerCase().includes(q),
    ).slice(0, 25)
  }, [leads, leadSearch])

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} cita{filtered.length !== 1 ? 's' : ''} · {format(month, 'MMMM yyyy', { locale: es })}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 self-start" onClick={handleOpenLeadSelect}>
          <Plus className="size-3.5" />Nueva cita
        </Button>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2 mb-6">

        {/* Month navigator */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border px-1 py-0.5">
          <Button
            size="icon" variant="ghost" className="size-8"
            onClick={() => fetchMonth(subMonths(month, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center px-1 select-none">
            {format(month, 'MMMM yyyy', { locale: es })}
          </span>
          <Button
            size="icon" variant="ghost" className="size-8"
            onClick={() => fetchMonth(addMonths(month, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Tipo */}
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className={cn('h-9 w-44 text-sm', filterTipo !== ALL && 'border-primary text-primary')}>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {appointmentTipoValues.map((t) => (
              <SelectItem key={t} value={t}>{APPOINTMENT_TIPO_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className={cn('h-9 w-40 text-sm', filterStatus !== ALL && 'border-primary text-primary')}>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {appointmentStatusValues
              .filter((s) => showCanceladas || s !== 'cancelada')
              .map((s) => (
                <SelectItem key={s} value={s}>{APPOINTMENT_STATUS_LABEL[s]}</SelectItem>
              ))}
          </SelectContent>
        </Select>

        {/* Toggle canceladas */}
        <Button
          size="sm"
          variant={showCanceladas ? 'secondary' : 'ghost'}
          className="h-9 text-xs"
          onClick={() => {
            const next = !showCanceladas
            setShowCanceladas(next)
            void fetchMonth(month, next)
          }}
        >
          {showCanceladas ? 'Ocultar canceladas' : 'Mostrar canceladas'}
        </Button>
      </div>

      {/* ── Agenda view ── */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <CalendarCheck className="size-10 text-muted-foreground/25 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Sin citas para este período</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Organizá una cita desde la ficha de un lead o usá el botón "Nueva cita".
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map(({ date, items }) => (
            <DaySection
              key={date.toISOString()}
              date={date}
              items={items}
              onApptClick={setSelectedAppt}
            />
          ))}
        </div>
      )}

      {/* ── Appointment detail sheet ── */}
      <AppointmentDetailSheet
        appointment={selectedAppt}
        onClose={() => setSelectedAppt(null)}
        onUpdated={refresh}
      />

      {/* ── Lead select dialog ── */}
      <Dialog
        open={showLeadSelect}
        onOpenChange={(v) => { if (!v) { setShowLeadSelect(false); setLeadSearch('') } }}
      >
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
                    onClick={() => {
                      setSelectedLead(l)
                      setShowLeadSelect(false)
                      setShowApptDialog(true)
                    }}
                    className="w-full text-left rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                  >
                    <div className="text-sm font-medium">{l.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.modelo ?? 'Sin modelo'} · {l.status}
                    </div>
                  </button>
                ))}
                {filteredLeads.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No se encontraron leads.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Appointment dialog (after lead selection) ── */}
      {selectedLead && (
        <AppointmentDialog
          open={showApptDialog}
          onOpenChange={(v) => {
            if (!v) { setShowApptDialog(false); setSelectedLead(null) }
          }}
          leadId={selectedLead.id}
          leadNombre={selectedLead.nombre}
          defaultModelo={selectedLead.modelo}
          onCreated={() => {
            setShowApptDialog(false)
            setSelectedLead(null)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

// ── DaySection ─────────────────────────────────────────────────────

function DaySection({
  date, items, onApptClick,
}: {
  date:        Date
  items:       ApptRow[]
  onApptClick: (a: ApptRow) => void
}) {
  const isToday = isSameDay(date, new Date())

  return (
    <div>
      {/* Day header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'flex flex-col items-center justify-center rounded-lg w-11 h-11 shrink-0 border select-none',
          isToday
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-muted/40 border-border',
        )}>
          <span className="text-[9px] font-semibold uppercase leading-none tracking-wider">
            {format(date, 'EEE', { locale: es }).replace('.', '')}
          </span>
          <span className="text-xl font-bold leading-tight">{format(date, 'd')}</span>
        </div>
        <div>
          <div className="text-sm font-semibold capitalize">
            {format(date, "EEEE d 'de' MMMM", { locale: es })}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {items.length} cita{items.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="ml-[56px] space-y-2">
        {items.map((appt) => (
          <ApptCard key={appt.id} appt={appt} onClick={() => onApptClick(appt)} />
        ))}
      </div>
    </div>
  )
}

// ── ApptCard ──────────────────────────────────────────────────────

const CARD_ACCENT: Record<string, string> = {
  programada:     'border-l-violet-400',
  realizada:      'border-l-emerald-400',
  no_se_presento: 'border-l-destructive/50',
  reagendada:     'border-l-amber-400',
  cancelada:      'border-l-muted-foreground/20',
}

function ApptCard({ appt, onClick }: { appt: ApptRow; onClick: () => void }) {
  const apptDate = new Date(appt.scheduled_at)
  const dur      = appt.duration_min
  const isPast   = appt.status === 'programada' && apptDate.getTime() < Date.now()

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-lg border bg-card p-3 cursor-pointer',
        'hover:shadow-md transition-shadow border-l-4',
        isPast ? 'border-l-amber-400' : (CARD_ACCENT[appt.status] ?? 'border-l-primary/40'),
        appt.status === 'cancelada' && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{appt.lead_nombre ?? 'Lead'}</span>
            <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium shrink-0">
              {APPOINTMENT_TIPO_LABEL[appt.tipo]}
            </span>
            {isPast && (
              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200/60 rounded-full px-1.5 py-0.5 font-medium shrink-0">
                Pasada
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {format(apptDate, 'HH:mm')}
            {' · '}
            {dur < 60 ? `${dur} min` : `${dur / 60} h`}
            {appt.lugar && ` · ${appt.lugar}`}
          </div>
        </div>

        {(appt.vendedor_alias || appt.vendedor_nombre) && (
          <div className="text-[11px] text-muted-foreground shrink-0 text-right">
            {appt.vendedor_alias || appt.vendedor_nombre}
          </div>
        )}
      </div>
    </div>
  )
}
