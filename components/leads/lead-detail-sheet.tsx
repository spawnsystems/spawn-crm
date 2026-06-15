'use client'

import { useState, useTransition, useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { StatusBadge } from '@/components/status-badge'
import { NextActionCard } from '@/components/leads/next-action-card'
import { LeadStatusStepper } from '@/components/leads/lead-status-stepper'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Phone, Mail, Car, CheckCircle2, Circle, CalendarIcon, FileText,
  MessageCircle, Send, Loader2, Pencil, X, Check,
  UserCircle, Plus, RotateCcw, UserPlus, UserCheck, ArrowRight,
  CalendarCheck, Trophy, LifeBuoy, AlertTriangle, CalendarX,
  ArrowRightLeft, PhoneCall, PhoneIncoming, PhoneOff, MinusCircle, Clock3, ChevronDown, Trash2, Calculator,
  Video, Building2, Handshake, MapPin,
} from 'lucide-react'
import {
  addNote, deleteNote, toggleTask, getLeadDetail,
  updateLead, addTask, assignLead, setLeadModelo,
} from '@/app/actions/leads'
import { requestTransfer } from '@/app/actions/transfers'
import { scheduleCall, registerCall } from '@/app/actions/calls'
import { BajaDialog } from '@/components/leads/baja-dialog'
import { CotizadorDialog, type EditingCotizacion } from '@/components/cotizador/cotizador-dialog'
import { getNextAppointmentForLead } from '@/app/actions/appointments'
import { getVendedoresParaTraspaso } from '@/app/actions/users'
import { getActiveModelNames } from '@/app/actions/modelos'
import { leadSourceValues } from '@/lib/schemas/leads'
import { PROVINCIAS_AR } from '@/lib/ar/provincias'
import { APPOINTMENT_TIPO_LABEL, type AppointmentTipo } from '@/lib/schemas/appointments'
import { isBaja } from '@/lib/leads/constants'
import { useCurrentUser } from '@/lib/tenant/context'
import type { Lead } from '@/lib/db'
import { cn, parseNumeric, safeRefetch, fmtDayMonthAR, toBADate, formatCurrencyARS } from '@/lib/utils'
import { formatHorarios } from '@/lib/leads/horarios'

// Sentinelas del selector de modelo (igual que en NewLeadDialog)
const SIN_MODELO  = '__sin_definir__'
const OTRO_MODELO = '__otro__'
const SIN_PROVINCIA = '__sin_provincia__'   // provincia desconocida

// ── Types ─────────────────────────────────────────────────────────

type DetailData   = Awaited<ReturnType<typeof getLeadDetail>>
type Vendedor     = Awaited<ReturnType<typeof getVendedoresParaTraspaso>>[number]
// getNextAppointmentForLead returns rows[0] which may be undefined at runtime
// even though TS infers the non-nullable element type; we always allow null.
type Appointment  = Awaited<ReturnType<typeof getNextAppointmentForLead>> | null

// ── Timeline event styles ─────────────────────────────────────────

type EventStyle = { bg: string; Icon: React.FC<{ className?: string }> }

const TIMELINE_EVENT_STYLE: Record<string, EventStyle> = {
  lead_created:            { bg: 'bg-slate-500',   Icon: UserPlus      },
  contacted:               { bg: 'bg-blue-500',    Icon: Phone         },
  status_changed:          { bg: 'bg-primary',     Icon: ArrowRight    },
  modelo_changed:          { bg: 'bg-primary',     Icon: Car           },
  reassigned:              { bg: 'bg-indigo-500',  Icon: UserCheck     },
  note_added:              { bg: 'bg-slate-400',   Icon: FileText      },
  note_deleted:            { bg: 'bg-rose-400',    Icon: X             },
  task_done:               { bg: 'bg-teal-500',    Icon: CheckCircle2  },
  appointment_scheduled:   { bg: 'bg-violet-500',  Icon: CalendarCheck },
  appointment_done:        { bg: 'bg-emerald-500', Icon: CheckCircle2  },
  appointment_cancelled:   { bg: 'bg-slate-400',   Icon: CalendarX     },
  appointment_no_show:     { bg: 'bg-orange-400',  Icon: AlertTriangle },
  appointment_rescheduled: { bg: 'bg-amber-400',   Icon: RotateCcw     },
  closed_won:              { bg: 'bg-emerald-600', Icon: Trophy        },
  reactivated_from_rescue: { bg: 'bg-amber-500',   Icon: LifeBuoy      },
  lead_baja:               { bg: 'bg-rose-500',      Icon: CalendarX        },
  transfer_requested:      { bg: 'bg-indigo-500',    Icon: ArrowRightLeft   },
  transfer_accepted:       { bg: 'bg-emerald-500',   Icon: ArrowRightLeft   },
  transfer_rejected:       { bg: 'bg-rose-400',      Icon: ArrowRightLeft   },
  transfer_cancelled:      { bg: 'bg-slate-400',     Icon: ArrowRightLeft   },
  call_scheduled:          { bg: 'bg-sky-500',       Icon: PhoneCall        },
  call_registered:         { bg: 'bg-teal-500',      Icon: PhoneIncoming    },
  call_canceled:           { bg: 'bg-slate-400',     Icon: PhoneOff         },
  cotizacion_created:      { bg: 'bg-amber-500',     Icon: Calculator       },
  cotizacion_updated:      { bg: 'bg-amber-400',     Icon: Calculator       },
  _default:                { bg: 'bg-muted-foreground', Icon: ArrowRight    },
}

// ── Preview limits ────────────────────────────────────────────────
// Cuántos ítems mostrar en cada sección antes de colapsar.
// "Ver más" expande el resto inline; el sheet no scrollea por defecto.
const PREVIEW_CALLS    = 1
const PREVIEW_NOTES    = 1
const PREVIEW_TIMELINE = 6

// ── Agenda derivada ───────────────────────────────────────────────
// "Próximas acciones" ya no es una lista manual: se arma sola a partir
// del estado real del lead (cita programada + llamadas pendientes +
// tareas manuales sin completar), ordenada por fecha. El vendedor
// puede sumar acciones manuales, pero las comunes aparecen solas.

type AgendaItem =
  | { kind: 'appointment'; id: string; date: Date;        overdue: boolean; tipo: AppointmentTipo; lugar: string | null }
  | { kind: 'call';        id: string; date: Date;        overdue: boolean; notas: string | null }
  | { kind: 'task';        id: string; date: Date | null;                   texto: string }

function buildAgenda(
  tasks: NonNullable<DetailData>['tasks'],
  calls: NonNullable<DetailData>['calls'],
  appt:  Appointment,
): AgendaItem[] {
  const now = Date.now()
  const items: AgendaItem[] = []

  // 1) Cita programada (a lo sumo una por lead)
  if (appt) {
    const d = new Date(appt.scheduled_at)
    items.push({
      kind: 'appointment', id: appt.id, date: d,
      overdue: d.getTime() < now, tipo: appt.tipo, lugar: appt.lugar,
    })
  }

  // 2) Llamadas pendientes (sin registrar)
  for (const c of calls) {
    if (c.realizada_at) continue
    const d = new Date(c.scheduled_at)
    items.push({
      kind: 'call', id: c.id, date: d,
      overdue: d.getTime() < now, notas: c.notas_previas,
    })
  }

  // 3) Tareas manuales sin completar
  for (const t of tasks) {
    if (t.done) continue
    items.push({
      kind: 'task', id: t.id,
      date: t.due_at ? new Date(t.due_at) : null,
      texto: t.texto,
    })
  }

  // Orden cronológico; las acciones sin fecha (tareas) van al final
  return items.sort((a, b) => {
    const at = a.date ? a.date.getTime() : Infinity
    const bt = b.date ? b.date.getTime() : Infinity
    return at - bt
  })
}

/** Formato compacto "mié 12/06 14:00" para la agenda. */
function fmtAgendaWhen(d: Date): string {
  return format(toBADate(d), "EEE d/MM HH:mm", { locale: es })
}

// ── Main component ────────────────────────────────────────────────

interface LeadDetailSheetProps {
  leadId:          string | null
  onClose:         () => void
  onStatusChange?: (leadId: string, status: string) => void
  /** Llamado cuando una mutación cambia datos que el padre necesita refrescar (ej: cotización). */
  onLeadsRefresh?: () => void
}

export function LeadDetailSheet({ leadId, onClose, onStatusChange, onLeadsRefresh }: LeadDetailSheetProps) {
  const currentUser = useCurrentUser()
  const [detail,          setDetail]          = useState<DetailData | null>(null)
  const [nextAppointment, setNextAppointment] = useState<Appointment>(null)
  const [loading,         setLoading]         = useState(false)
  const [vendedores,      setVendedores]      = useState<Vendedor[]>([])
  const [newNote,         setNewNote]         = useState('')
  const [newTask,         setNewTask]         = useState('')
  const [taskDueAt,       setTaskDueAt]       = useState<Date | undefined>()
  const [dueCalendarOpen, setDueCalendarOpen] = useState(false)
  const [editing,         setEditing]         = useState(false)
  const [editForm,        setEditForm]        = useState<Partial<Lead>>({})
  const [modelos,         setModelos]         = useState<string[]>([])
  // Editor inline del modelo de interés (visual, registra en el historial)
  const [editingModelo,   setEditingModelo]   = useState(false)
  const [mSel,            setMSel]            = useState<string>(SIN_MODELO)
  const [mCustom,         setMCustom]         = useState('')
  const [showBaja,         setShowBaja]         = useState(false)
  const [showCotizador,    setShowCotizador]    = useState(false)
  const [editingCotizacion, setEditingCotizacion] = useState<EditingCotizacion | null>(null)
  const [showTransfer,     setShowTransfer]     = useState(false)
  const [showReassign,     setShowReassign]     = useState(false)
  const [showScheduleCall, setShowScheduleCall] = useState(false)
  // Registro de llamada: { callId } para una agendada, { leadId } para ad-hoc.
  const [registerTarget,   setRegisterTarget]   = useState<{ callId?: string; leadId?: string } | null>(null)
  const [showTimelineDialog, setShowTimelineDialog] = useState(false)
  const [showAllCalls,    setShowAllCalls]    = useState(false)
  const [showAllNotes,    setShowAllNotes]    = useState(false)
  const [isPending,       startTransition]    = useTransition()

  // Fetch all data when sheet opens.
  // `cancelled` flag prevents stale updates on quick open/close.
  useEffect(() => {
    if (!leadId) { setDetail(null); setNextAppointment(null); setEditing(false); return }
    // Colapsar secciones cuando se abre un lead nuevo; limpiar detail para no
    // mostrar datos del lead anterior mientras carga (evita stale render).
    setDetail(null)
    setShowAllCalls(false)
    setShowAllNotes(false)
    setLoading(true)
    let cancelled = false

    Promise.all([
      getLeadDetail(leadId),
      getNextAppointmentForLead(leadId),
      getVendedoresParaTraspaso(),
      getActiveModelNames(),
    ])
      .then(([d, appt, v, mods]) => {
        if (cancelled) return
        setDetail(d)
        setNextAppointment(appt)
        setVendedores(v)
        setModelos(mods)
        if (d) setEditForm(d.lead)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[lead-detail-sheet] load', err)
        toast.error('No se pudo cargar el lead')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [leadId])

  const lead            = detail?.lead

  // Abre el editor inline de modelo posicionado en el valor actual:
  //   vacío → "Sin definir" · en catálogo → esa opción · otro → texto libre
  function startEditModelo() {
    if (!lead) return
    const m = (lead.modelo ?? '').trim()
    if (!m)                       { setMSel(SIN_MODELO);  setMCustom('') }
    else if (modelos.includes(m)) { setMSel(m);           setMCustom('') }
    else                          { setMSel(OTRO_MODELO); setMCustom(m) }
    setEditingModelo(true)
  }

  function saveModelo() {
    if (!lead) return
    const id = lead.id
    const modeloFinal = mSel === SIN_MODELO
      ? null
      : mSel === OTRO_MODELO
      ? (mCustom.trim() || null)
      : mSel
    startTransition(async () => {
      const res = await setLeadModelo(id, modeloFinal)
      if (!res.success) { toast.error(res.error); return }
      setEditingModelo(false)
      const updated = await safeRefetch(
        () => getLeadDetail(id),
        'Modelo actualizado, pero no se pudo refrescar la ficha',
      )
      if (updated) setDetail(updated)
      toast.success('Modelo actualizado')
    })
  }

  const notes           = detail?.notes          ?? []
  const timeline        = detail?.timeline        ?? []
  const tasks           = detail?.tasks           ?? []
  const calls           = detail?.calls           ?? []
  const cotizaciones    = detail?.cotizaciones    ?? []

  // Agenda derivada: cita + llamadas pendientes + tareas, ordenada por fecha
  const agenda = buildAgenda(tasks, calls, nextAppointment)

  // Racha de "no contestó" sin interrupción (intentos ya realizados, más
  // recientes primero). El diálogo de registro la usa para sugerir un reintento
  // (si está dentro de los intentos) o, ya pasados, sugerir dar de baja.
  const unansweredStreak = (() => {
    const done = calls
      .filter((c) => c.realizada_at)
      .sort((a, b) => new Date(b.realizada_at!).getTime() - new Date(a.realizada_at!).getTime())
    let n = 0
    for (const c of done) { if (c.outcome === 'no_contesto') n++; else break }
    return n
  })()

  // ¿Hay una llamada pendiente viva? (sin registrar ni cancelar). Solo puede
  // haber una por lead; agendar otra reemplaza (cancela) la anterior.
  const hasPendingCall = calls.some((c) => !c.realizada_at && !c.canceled_at)

  /** Re-fetch everything (called after mutations in NextActionCard) */
  async function refreshAll() {
    if (!leadId) return
    const [d, appt] = await Promise.all([
      safeRefetch(() => getLeadDetail(leadId),             'No se pudo actualizar la ficha'),
      safeRefetch(() => getNextAppointmentForLead(leadId), 'No se pudo actualizar la cita'),
    ])
    if (d) {
      setDetail(d)
      setEditForm(d.lead)
      if (d.lead.status !== lead?.status) {
        onStatusChange?.(leadId, d.lead.status)
      }
    }
    setNextAppointment(appt ?? null)
  }

  // Was this lead ever rescued from rescate?
  const wasRescued = timeline.some((e) => e.event_type === 'reactivated_from_rescue')

  // Lead terminal (vendido o dado de baja): el vendedor no puede tocar nada más.
  // Un supervisor o superior sí puede seguir editando (corregir datos, rescatar).
  const isTerminal = !!lead && (lead.status === 'VENTA' || isBaja(lead.status))
  const readOnly   = isTerminal && currentUser.rol === 'vendedor'

  // ── Mutations ──────────────────────────────────────────────────

  function handleToggleTask(taskId: string, done: boolean) {
    startTransition(async () => {
      const res = await toggleTask(taskId, done)
      if (!res.success) { toast.error(res.error); return }
      // refreshAll en vez de optimistic: así el timeline también se actualiza
      // en tiempo real (la tarea desaparece de la agenda Y aparece en el historial).
      await refreshAll()
    })
  }

  function handleDeleteNote(noteId: string) {
    if (!lead) return
    if (!confirm('¿Borrar esta nota? Esta acción queda registrada en el historial.')) return
    const id = lead.id
    startTransition(async () => {
      const res = await deleteNote(noteId)
      if (!res.success) { toast.error(res.error); return }
      const updated = await safeRefetch(
        () => getLeadDetail(id),
        'Nota borrada, pero no se pudo refrescar la ficha',
      )
      if (updated) setDetail(updated)
      toast.success('Nota borrada')
    })
  }

  function handleAddNote() {
    if (!lead || !newNote.trim()) return
    const id = lead.id
    startTransition(async () => {
      const res = await addNote(id, newNote.trim())
      if (!res.success) { toast.error(res.error); return }
      setNewNote('')
      const updated = await safeRefetch(
        () => getLeadDetail(id),
        'Nota guardada, pero no se pudo refrescar la ficha',
      )
      if (updated) setDetail(updated)
      toast.success('Nota guardada')
    })
  }

  function handleAddTask() {
    if (!lead || !newTask.trim()) return
    const id = lead.id
    startTransition(async () => {
      const res = await addTask(id, newTask.trim(), taskDueAt)
      if (!res.success) { toast.error(res.error); return }
      setNewTask('')
      setTaskDueAt(undefined)
      const updated = await safeRefetch(
        () => getLeadDetail(id),
        'Tarea agregada, pero no se pudo refrescar la ficha',
      )
      if (updated) setDetail(updated)
      toast.success('Tarea agregada')
    })
  }

  function handleSaveEdit() {
    if (!lead) return
    // El modelo se edita aparte (control dedicado, con registro en historial).
    startTransition(async () => {
      const res = await updateLead(lead.id, {
        nombre:      editForm.nombre,
        telefono:    editForm.telefono ?? undefined,
        email:       editForm.email    ?? undefined,
        localidad:   editForm.localidad ?? undefined,
        provincia:   editForm.provincia ?? undefined,
        source:      editForm.source,
        next_action: editForm.next_action ?? undefined,
        est_value:   parseNumeric(editForm.est_value),
      })
      if (res.success) {
        setDetail((d) => d ? { ...d, lead: { ...d.lead, ...editForm } } : d)
        setEditing(false)
        toast.success('Lead actualizado')
      } else {
        toast.error(res.error)
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      {/* [&>button]:hidden oculta el X absoluto por defecto de shadcn */}
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-0 [&>button]:hidden">

        {loading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && lead && (
          <>
            {/* ── Header ── */}
            <SheetHeader className="p-6 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">

                  {/* Name + badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <SheetTitle className="text-xl">{lead.nombre}</SheetTitle>
                    {wasRescued && !isBaja(lead.status) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-200/60 rounded-full px-2 py-0.5">
                        <RotateCcw className="size-2.5" />
                        Reactivado del rescate
                      </span>
                    )}
                    {!readOnly && (
                      <button
                        onClick={() => setEditing((v) => !v)}
                        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground ml-auto sm:ml-0"
                        title="Editar lead"
                      >
                        {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
                      </button>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {lead.telefono && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5" />{lead.telefono}
                      </span>
                    )}
                    {lead.email && (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-3.5" />{lead.email}
                      </span>
                    )}
                    {(lead.localidad || lead.provincia) && (
                      <span className="inline-flex items-center gap-1.5" title="Ubicación">
                        <MapPin className="size-3.5" />{[lead.localidad, lead.provincia].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {formatHorarios(lead.horario_preferencia) && (
                      <span className="inline-flex items-center gap-1.5" title="Horarios de preferencia">
                        <Clock3 className="size-3.5" />{formatHorarios(lead.horario_preferencia)}
                      </span>
                    )}
                    {detail?.lead.creator_nombre && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
                        <UserPlus className="size-3" />
                        Cargado por <span className="font-medium text-foreground/70">{detail.lead.creator_nombre}</span>
                      </span>
                    )}
                  </div>

                  {/* Modelo de interés (visual + editable) + Status.
                      La etapa avanza con las acciones, no se edita a mano. */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {editingModelo ? (
                      <div className="flex items-center gap-2 flex-wrap rounded-lg border border-primary/30 bg-primary/5 p-2">
                        <Car className="size-4 text-primary shrink-0" />
                        <Select value={mSel} onValueChange={(v) => { setMSel(v); if (v !== OTRO_MODELO) setMCustom('') }}>
                          <SelectTrigger className="h-8 w-auto min-w-[160px] text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SIN_MODELO}>
                              <span className="text-muted-foreground">Sin definir</span>
                            </SelectItem>
                            {modelos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            <SelectItem value={OTRO_MODELO}>
                              <span className="text-muted-foreground">Otro (escribir)</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {mSel === OTRO_MODELO && (
                          <Input
                            value={mCustom}
                            onChange={(e) => setMCustom(e.target.value)}
                            placeholder="Escribí el modelo..."
                            className="h-8 w-40 text-sm"
                            autoFocus
                          />
                        )}
                        <Button size="sm" className="h-8" onClick={saveModelo} disabled={isPending}>
                          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : 'Guardar'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingModelo(false)} disabled={isPending}>
                          Cancelar
                        </Button>
                      </div>
                    ) : lead.modelo ? (
                      <>
                        <span className="inline-flex items-center gap-1.5">
                          <Car className="size-4 text-primary" />
                          <span className="font-medium">{lead.modelo}</span>
                        </span>
                        {!readOnly && (
                          <button
                            onClick={startEditModelo}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Cambiar
                          </button>
                        )}
                        <StatusBadge status={lead.status} />
                      </>
                    ) : (
                      <>
                        {!readOnly ? (
                          <button
                            onClick={startEditModelo}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            <Car className="size-3.5 shrink-0" />
                            Este lead todavía no eligió un modelo · Agregar
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Car className="size-4" />Sin definir
                          </span>
                        )}
                        <StatusBadge status={lead.status} />
                      </>
                    )}
                  </div>

                  {/* Vendedor asignado — display de solo lectura. La reasignación
                      (supervisor+) se hace con el botón "Reasignar"; el vendedor
                      con "Transferir" (pide aprobación). */}
                  {currentUser.rol === 'vendedor' ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserCircle className="size-3.5 shrink-0" />
                      <span>Asignado a vos</span>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserCircle className="size-3.5 shrink-0" />
                      {(() => {
                        const v = vendedores.find((x) => x.user_id === lead.assigned_to)
                        const name = v ? (v.alias || v.nombre || v.user_id) : null
                        return name ? (
                          <span>Asignado a <span className="font-medium text-foreground">{name}</span></span>
                        ) : (
                          <span className="italic">Sin asignar</span>
                        )
                      })()}
                    </div>
                  )}
                </div>

                {/* Quick-action buttons */}
                <div className="flex shrink-0 flex-col gap-2">
                  {lead.telefono && (
                    <Button size="sm" variant="outline" className="gap-1.5" asChild>
                      <a href={`https://wa.me/${lead.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                        <MessageCircle className="size-3.5 text-success" />WhatsApp
                      </a>
                    </Button>
                  )}
                  {lead.telefono && (
                    <Button size="sm" variant="outline" className="gap-1.5" asChild>
                      <a href={`tel:${lead.telefono}`}>
                        <Phone className="size-3.5" />Llamar
                      </a>
                    </Button>
                  )}
                  {/* Mover el lead — un solo control según el rol:
                      · vendedor   → "Transferir" (pide aprobación del supervisor)
                      · supervisor+ → "Reasignar" (inmediato, sin aprobación) */}
                  {!isBaja(lead.status) && lead.status !== 'VENTA' && (
                    currentUser.rol === 'vendedor' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 mt-1"
                        onClick={() => setShowTransfer(true)}
                        title="Transferir este lead a otro vendedor (requiere aprobación del supervisor)"
                      >
                        <ArrowRightLeft className="size-3.5" />
                        Transferir
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 mt-1"
                        onClick={() => setShowReassign(true)}
                        title="Reasignar este lead a otro vendedor de tu equipo"
                      >
                        <UserCheck className="size-3.5" />
                        Reasignar
                      </Button>
                    )
                  )}
                  {/* Dar de baja — solo si el lead aún está activo */}
                  {!isBaja(lead.status) && lead.status !== 'VENTA' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      onClick={() => setShowBaja(true)}
                      title="Dar de baja este lead"
                    >
                      <X className="size-3.5" />
                      Dar de baja
                    </Button>
                  )}
                </div>
              </div>
            </SheetHeader>

            {/* ── Observación de carga ── */}
            {/* Comentario que dejó quien cargó el lead (dueño/supervisor/gerente).
                Se guarda en leads.observaciones pero antes no se mostraba en ningún
                lado: el vendedor asignado nunca lo veía. Acá lo surfaceamos. */}
            {lead.observaciones && (
              <div className="px-6 pt-4">
                <div className="rounded-lg border border-amber-200/60 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-amber-800">
                    <MessageCircle className="size-3.5" />
                    Observación de quien cargó el lead
                  </div>
                  <p className="text-sm text-amber-900/80 whitespace-pre-wrap">{lead.observaciones}</p>
                </div>
              </div>
            )}

            {/* ── Acción principal + Usado (siempre lado a lado en pantallas grandes) ── */}
            <div className="px-6 pt-4 mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* wrapper para que el fragment de NextActionCard sea un solo ítem del grid */}
              <div>
                <NextActionCard
                  lead={lead}
                  nextAppointment={nextAppointment}
                  onLeadUpdated={refreshAll}
                  onRegisterCall={() => setRegisterTarget({ leadId: lead.id })}
                />
              </div>
              {/* UsadoCard SIEMPRE visible — si no hay usado muestra botón de agregar */}
              <UsadoCard
                cotizaciones={cotizaciones}
                tieneUsado={lead?.tiene_usado ?? false}
                usadoMarca={lead?.usado_marca ?? null}
                usadoAnio={lead?.usado_anio ?? null}
                usadoKm={lead?.usado_km ?? null}
                readOnly={readOnly}
                onNew={() => { setEditingCotizacion(null); setShowCotizador(true) }}
                onEdit={(c) => { setEditingCotizacion(c); setShowCotizador(true) }}
              />
            </div>

            {/* ── Edit form ── */}
            {editing && (
              <div className="border-b border-border bg-muted/30 px-6 pb-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Editar lead</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      value={editForm.nombre ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      value={editForm.telefono ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, telefono: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={editForm.email ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Localidad</Label>
                    <Input
                      value={editForm.localidad ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, localidad: e.target.value }))}
                      placeholder="Sin especificar"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Provincia</Label>
                    <Select
                      value={editForm.provincia || undefined}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, provincia: v === SIN_PROVINCIA ? '' : v }))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Sin especificar" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value={SIN_PROVINCIA}>
                          <span className="text-muted-foreground">Sin especificar</span>
                        </SelectItem>
                        {PROVINCIAS_AR.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Origen</Label>
                    <Select
                      value={editForm.source ?? 'Otro'}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, source: v as Lead['source'] }))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {leadSourceValues.map((s) => (
                          <SelectItem key={s} value={s}>
                            {/* Si el lead tiene un origen personalizado, mostramos
                                su nombre real en lugar del genérico "Otro". */}
                            {s === 'Otro' && lead.source_custom ? lead.source_custom : s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor estimado ($)</Label>
                    <Input
                      type="number"
                      value={editForm.est_value ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, est_value: e.target.value as unknown as Lead['est_value'] }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Próxima acción</Label>
                    <Input
                      value={editForm.next_action ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, next_action: e.target.value }))}
                      placeholder="Ej: Llamar el lunes"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" onClick={handleSaveEdit} disabled={isPending} className="gap-1.5">
                    {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Guardar cambios
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditForm(lead) }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* ── Body ── */}
            <div className="grid grid-cols-3 gap-6 p-6">
              {/* Left col — 2/3 width */}
              <div className="col-span-2 space-y-6">

                {/* Próximas acciones — agenda derivada (cita + llamadas + tareas) */}
                <Section icon={<CalendarIcon className="size-4" />} title="Próximas acciones">
                  {agenda.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-3">
                      No hay acciones pendientes. Se generan solas al agendar una llamada o
                      cita; también podés sumar una manual.
                    </p>
                  )}
                  {agenda.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {agenda.map((item) => (
                        <AgendaRow
                          key={`${item.kind}-${item.id}`}
                          item={item}
                          isPending={isPending}
                          onRegisterCall={() => setRegisterTarget({ callId: item.id })}
                          onCompleteTask={() => handleToggleTask(item.id, true)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Agregar acción manual — con fecha/hora opcional */}
                  {!readOnly && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Acción manual (ej: enviar cotización)..."
                        className="h-8 text-sm"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask() }}
                      />
                      {/* Due date picker */}
                      <Popover open={dueCalendarOpen} onOpenChange={setDueCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(
                              'h-8 gap-1.5 shrink-0 text-xs px-2',
                              taskDueAt ? 'border-primary text-primary' : 'text-muted-foreground',
                            )}
                            title="Fecha límite"
                          >
                            <CalendarIcon className="size-3.5" />
                            {taskDueAt ? format(taskDueAt, 'dd/MM') : 'Fecha'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="single"
                            selected={taskDueAt}
                            onSelect={(d) => { setTaskDueAt(d); setDueCalendarOpen(false) }}
                            initialFocus
                          />
                          {taskDueAt && (
                            <div className="p-2 border-t border-border">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full h-7 text-xs text-muted-foreground"
                                onClick={() => { setTaskDueAt(undefined); setDueCalendarOpen(false) }}
                              >
                                <X className="size-3 mr-1" />Quitar fecha
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>

                      <Button
                        size="sm" variant="outline" className="h-8 gap-1 shrink-0"
                        onClick={handleAddTask}
                        disabled={!newTask.trim() || isPending}
                      >
                        <Plus className="size-3.5" />Agregar
                      </Button>
                    </div>
                  </div>
                  )}
                </Section>

                {/* Llamadas */}
                <Section icon={<PhoneCall className="size-4" />} title="Llamadas">
                  {calls.length > 0 && (() => {
                    // Pendientes vivas (sin registrar ni cancelar) primero;
                    // realizadas y canceladas después (orden del server: recientes primero).
                    const sorted = [...calls].sort((a, b) => {
                      const aLive = !a.realizada_at && !a.canceled_at ? 0 : 1
                      const bLive = !b.realizada_at && !b.canceled_at ? 0 : 1
                      return aLive - bLive
                    })
                    const visible = showAllCalls ? sorted : sorted.slice(0, PREVIEW_CALLS)
                    const hiddenCount = sorted.length - PREVIEW_CALLS
                    return (
                      <div className="mb-3">
                        <div className="space-y-2">
                          {visible.map((call) => (
                            <CallCard
                              key={call.id}
                              call={call}
                              onRegister={() => setRegisterTarget({ callId: call.id })}
                            />
                          ))}
                        </div>
                        {sorted.length > PREVIEW_CALLS && (
                          <button
                            onClick={() => setShowAllCalls((v) => !v)}
                            className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ChevronDown className={cn('size-3 transition-transform', showAllCalls && 'rotate-180')} />
                            {showAllCalls ? 'Ver menos' : `Ver ${hiddenCount} más`}
                          </button>
                        )}
                      </div>
                    )
                  })()}
                  {calls.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-3">Sin llamadas coordinadas.</p>
                  )}
                  {!isBaja(lead.status) && lead.status !== 'VENTA' && (
                    <Button
                      size="sm" variant="outline"
                      className="w-full gap-1.5 text-sky-600 hover:text-sky-700 hover:bg-sky-50 border-sky-200"
                      onClick={() => setShowScheduleCall(true)}
                    >
                      <PhoneCall className="size-3.5" />
                      {hasPendingCall ? 'Reagendar llamada' : 'Agendar llamada'}
                    </Button>
                  )}
                  {hasPendingCall && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Ya hay una llamada pendiente. Si agendás otra, esta se cancela.
                    </p>
                  )}
                </Section>

                {/* Notes */}
                <Section icon={<FileText className="size-4" />} title="Notas internas">
                  <div className="mb-3">
                    {notes.length === 0 && (
                      <p className="text-sm text-muted-foreground mb-2">Sin notas aún.</p>
                    )}
                    {notes.length > 0 && (() => {
                      // El server ya las devuelve en orden DESC (recientes primero)
                      const sorted = notes
                      const visible = showAllNotes ? sorted : sorted.slice(0, PREVIEW_NOTES)
                      const hiddenCount = sorted.length - PREVIEW_NOTES
                      return (
                        <>
                          <div className="space-y-2">
                            {visible.map((n) => {
                              // Borrado permitido: dueño SIEMPRE, o el autor de la nota.
                              const canDelete =
                                currentUser.rol === 'dueno' ||
                                ('author_id' in n && n.author_id === currentUser.id)
                              return (
                                <div key={n.id} className="group relative rounded-lg border border-border p-3 bg-muted/30">
                                  <div className="text-xs text-muted-foreground mb-1">
                                    {n.autor ?? 'Usuario'} ·{' '}
                                    {fmtDayMonthAR(n.created_at)}
                                  </div>
                                  <div className="text-sm">{n.texto}</div>
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDeleteNote(n.id)}
                                      disabled={isPending}
                                      className="absolute top-2 right-2 p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                      title="Borrar nota"
                                      aria-label="Borrar nota"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          {sorted.length > PREVIEW_NOTES && (
                            <button
                              onClick={() => setShowAllNotes((v) => !v)}
                              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ChevronDown className={cn('size-3 transition-transform', showAllNotes && 'rotate-180')} />
                              {showAllNotes ? 'Ver menos' : `Ver ${hiddenCount} anteriores`}
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  {!readOnly && (
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Agregar nota... (Ctrl+Enter para guardar)"
                        className="text-sm min-h-[60px] resize-none"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote() }}
                      />
                      <Button
                        size="sm" className="shrink-0 self-end gap-1.5"
                        onClick={handleAddNote}
                        disabled={!newNote.trim() || isPending}
                      >
                        <Send className="size-3.5" />Guardar
                      </Button>
                    </div>
                  )}
                </Section>
              </div>

              {/* Right col — timeline */}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
                  Historial
                </div>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin actividad.</p>
                ) : (
                  <>
                    <TimelineList events={timeline.slice(0, PREVIEW_TIMELINE)} />
                    {timeline.length > PREVIEW_TIMELINE && (
                      <button
                        onClick={() => setShowTimelineDialog(true)}
                        className="mt-1 text-xs text-primary hover:underline"
                      >
                        Ver todos ({timeline.length - PREVIEW_TIMELINE} más)
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Full timeline dialog */}
              <Dialog open={showTimelineDialog} onOpenChange={setShowTimelineDialog}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Historial completo</DialogTitle>
                  </DialogHeader>
                  <div className="py-2">
                    <TimelineList events={timeline} />
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* ── Status stepper (footer) ── */}
            <div className="border-t border-border px-6 py-4 bg-muted/20">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                Progreso del lead
              </div>
              <LeadStatusStepper
                status={lead.status}
                wasRescued={wasRescued}
              />
            </div>

            {/* ── Schedule call dialog ── */}
            <ScheduleCallDialog
              open={showScheduleCall}
              onOpenChange={setShowScheduleCall}
              leadId={lead.id}
              onDone={() => { setShowScheduleCall(false); refreshAll() }}
            />

            {/* ── Register call dialog ── */}
            <RegisterCallDialog
              open={!!registerTarget}
              callId={registerTarget?.callId}
              leadId={registerTarget?.leadId}
              unansweredSoFar={unansweredStreak}
              onOpenChange={(v) => { if (!v) setRegisterTarget(null) }}
              onDone={(outcome, unansweredStreak) => {
                setRegisterTarget(null)
                refreshAll()
                if (outcome === 'descartado') {
                  setShowBaja(true)
                } else if (outcome === 'no_contesto' && (unansweredStreak ?? 0) >= 3) {
                  // Sugerencia (no automática): tras varios intentos sin respuesta,
                  // ofrecer dar de baja como "NO CONTESTA" (rescatable).
                  toast.warning(`No contesta hace ${unansweredStreak} intentos`, {
                    description: 'Quizás convenga darlo de baja como “NO CONTESTA” (después se puede rescatar).',
                    duration: 10000,
                    action: { label: 'Dar de baja', onClick: () => setShowBaja(true) },
                  })
                }
              }}
            />

            {/* ── Baja dialog ── */}
            <BajaDialog
              open={showBaja}
              onOpenChange={setShowBaja}
              leadId={lead.id}
              leadNombre={lead.nombre}
              onDone={() => {
                setShowBaja(false)
                refreshAll()
                onStatusChange?.(lead.id, lead.status)
              }}
            />

            {/* ── Cotizador dialog ── */}
            <CotizadorDialog
              open={showCotizador}
              onOpenChange={(v) => { setShowCotizador(v); if (!v) setEditingCotizacion(null) }}
              leadId={lead.id}
              leadNombre={lead.nombre}
              provincia={lead.provincia ?? undefined}
              editing={editingCotizacion}
              initialMarca={!editingCotizacion ? (lead.usado_marca ?? undefined) : undefined}
              initialAnio={!editingCotizacion ? (lead.usado_anio ?? undefined) : undefined}
              initialKm={!editingCotizacion ? (lead.usado_km ?? undefined) : undefined}
              initialUso={!editingCotizacion ? (lead.usado_uso ?? undefined) : undefined}
              initialValor={!editingCotizacion && lead.usado_valor_infoauto != null ? Number(lead.usado_valor_infoauto) : undefined}
              onCreated={() => {
                setShowCotizador(false)
                setEditingCotizacion(null)
                refreshAll()
                // Refrescar la lista del padre para actualizar el badge de "Usado"
                onLeadsRefresh?.()
              }}
            />

            {/* ── Transfer dialog (vendedor) ── */}
            <TransferDialog
              open={showTransfer}
              onOpenChange={setShowTransfer}
              leadId={lead.id}
              leadNombre={lead.nombre}
              assignedTo={lead.assigned_to ?? null}
              vendedores={vendedores}
              onDone={() => {
                setShowTransfer(false)
                refreshAll()
              }}
            />

            {/* ── Reassign dialog (supervisor+) ── */}
            <ReassignDialog
              open={showReassign}
              onOpenChange={setShowReassign}
              leadId={lead.id}
              leadNombre={lead.nombre}
              assignedTo={lead.assigned_to ?? null}
              vendedores={vendedores}
              onDone={() => {
                setShowReassign(false)
                refreshAll()
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────

type TimelineEvent = NonNullable<DetailData>['timeline'][number]

function TimelineList({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="relative">
      <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />
      {events.map((e) => {
        const { bg, Icon } = TIMELINE_EVENT_STYLE[e.event_type] ?? TIMELINE_EVENT_STYLE._default
        return (
          <div key={e.id} className="relative flex gap-3 pb-4">
            <div className={cn(
              'relative z-10 shrink-0 size-[18px] rounded-full mt-0.5',
              'ring-2 ring-background flex items-center justify-center text-white',
              bg,
            )}>
              <Icon className="size-2.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground leading-none mb-0.5">
                {format(toBADate(e.created_at), 'dd/MM HH:mm')}
              </div>
              <div className="text-sm font-medium">{e.title}</div>
              {e.description && (
                <div className="text-xs text-muted-foreground mt-0.5">{e.description}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Section({ icon, title, children }: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

// ── UsadoCard ─────────────────────────────────────────────────────
// Siempre visible. Si no hay cotizaciones, invita a agregar uno.
// Cada cotización usa layout vertical (sin truncado):
//   línea 1: marca/modelo
//   línea 2: año · km · uso
//   línea 3: valor de toma  (o badge "Rechazado")
// Lápiz en top-right de cada fila edita esa cotización.
// Botón "+" en header agrega una para otro auto.

function UsadoCard({
  cotizaciones, tieneUsado, usadoMarca, usadoAnio, usadoKm, onNew, onEdit, readOnly = false,
}: {
  cotizaciones: NonNullable<DetailData>['cotizaciones']
  tieneUsado:   boolean
  usadoMarca:   string | null
  usadoAnio:    number | null
  usadoKm:      number | null
  onNew:        () => void
  onEdit:       (c: EditingCotizacion) => void
  readOnly?:    boolean
}) {
  const isEmpty = cotizaciones.length === 0
  // Tiene auto anotado pero sin cotización completa todavía
  const pendienteCotizar = isEmpty && tieneUsado

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 h-full',
      isEmpty && !tieneUsado
        ? 'bg-muted/30 border-dashed border-border'
        : isEmpty
        ? 'bg-amber-50/40 border-amber-200/60 border-dashed'
        : 'bg-amber-50 border-amber-200/60',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5">
          <Car className={cn('size-4 shrink-0', isEmpty && !tieneUsado ? 'text-muted-foreground' : 'text-amber-700')} />
          <span className={cn('text-sm font-semibold', isEmpty && !tieneUsado ? 'text-muted-foreground' : 'text-amber-800')}>
            Usado en parte de pago
          </span>
        </div>

        {readOnly ? null : isEmpty ? (
          /* Sin cotizaciones → botón para iniciar (o completar) */
          <button
            onClick={onNew}
            title={pendienteCotizar ? 'Completar cotización' : 'Agregar usado'}
            aria-label={pendienteCotizar ? 'Completar cotización' : 'Agregar usado'}
            className={cn(
              'shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
              pendienteCotizar
                ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            <Plus className="size-3.5" />
            {pendienteCotizar ? 'Cotizar' : 'Agregar'}
          </button>
        ) : (
          /* Con cotizaciones → "+" para otro auto */
          <button
            onClick={onNew}
            title="Nueva cotización (otro auto)"
            aria-label="Nueva cotización"
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <Plus className="size-3.5" />
            Nuevo
          </button>
        )}
      </div>

      {pendienteCotizar ? (
        /* Tiene auto anotado pero sin cotización — CTA prominente */
        <div>
          {(usadoMarca || usadoAnio || usadoKm != null) && (
            <p className="text-sm font-medium text-amber-800 mb-1">
              {[
                usadoMarca,
                usadoAnio,
                usadoKm != null ? `${usadoKm.toLocaleString('es-AR')} km` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-xs text-amber-700/80">
            Falta {[usadoKm == null ? 'km' : null, 'valor InfoAuto'].filter(Boolean).join(' y ')} para calcular el precio de toma.
          </p>
          {!readOnly && (
            <button
              onClick={onNew}
              className="mt-2 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors"
            >
              Completar cotización →
            </button>
          )}
        </div>
      ) : isEmpty ? (
        <p className="text-xs text-muted-foreground/70">
          El cliente no tiene un usado por ahora. Si lo consigue, podés cotizarlo acá.
        </p>
      ) : (
        <div className="space-y-2">
          {cotizaciones.map((c, idx) => {
            const uso = c.uso === 'taxi_uber_transporte' ? 'Taxi/Uber' : 'Particular'

            // ── Cotizaciones anteriores: compactas, sin editar, apagadas ──
            if (idx > 0) {
              return (
                <div
                  key={c.id}
                  className="rounded border border-border/40 bg-muted/20 px-2.5 py-1.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-muted-foreground/70 truncate">
                      {c.marca_modelo || <span className="italic">Sin marca/modelo</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {[
                        c.anio ? String(c.anio) : null,
                        c.km != null ? `${Number(c.km).toLocaleString('es-AR')} km` : null,
                        uso,
                      ].filter(Boolean).join(' · ')}
                      {' · '}{fmtDayMonthAR(c.created_at)}
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium shrink-0',
                    c.rechazado ? 'text-rose-400' : 'text-muted-foreground/60',
                  )}>
                    {c.rechazado
                      ? 'Rechazado'
                      : formatCurrencyARS(c.valor_final)}
                  </span>
                </div>
              )
            }

            // ── Cotización activa (la más reciente) ──
            return (
              <div
                key={c.id}
                className={cn(
                  'rounded-lg border bg-white/80 overflow-hidden',
                  c.rechazado ? 'border-rose-200' : 'border-emerald-200/80',
                )}
              >
                {/* Top bar: nombre + lápiz */}
                <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-1">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {c.marca_modelo || <span className="text-muted-foreground italic">Sin marca/modelo</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {[
                        c.anio ? String(c.anio) : null,
                        c.km != null ? `${Number(c.km).toLocaleString('es-AR')} km` : null,
                        uso,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => onEdit({
                        id:            c.id,
                        marca_modelo:  c.marca_modelo,
                        anio:          c.anio,
                        km:            c.km != null ? Number(c.km) : null,
                        uso:           c.uso ?? 'particular',
                        base_infoauto: c.base_infoauto ?? 0,
                      })}
                      title="Editar esta cotización"
                      aria-label="Editar cotización"
                      className="shrink-0 p-1 rounded text-muted-foreground/50 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                    >
                      <Pencil className="size-3" />
                    </button>
                  )}
                </div>

                {/* Bottom bar: valor o rechazado */}
                <div className={cn(
                  'px-3 py-1.5 border-t',
                  c.rechazado
                    ? 'bg-rose-50/60 border-rose-100'
                    : 'bg-emerald-50/60 border-emerald-100',
                )}>
                  {c.rechazado ? (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="size-3 text-rose-600 shrink-0" />
                      <span className="text-[11px] font-semibold text-rose-700">
                        Rechazado
                        {c.rechazo_motivo ? ` — ${c.rechazo_motivo}` : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        Valor de toma{c.descuento_pct ? ` (−${Number(c.descuento_pct)}%)` : ''}
                      </span>
                      <span className="text-sm font-bold text-emerald-700">
                        {formatCurrencyARS(c.valor_final)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Etiqueta de fecha */}
                <div className="px-3 py-1 text-[10px] text-muted-foreground/60 bg-muted/10">
                  Última · {fmtDayMonthAR(c.created_at)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── AgendaRow ─────────────────────────────────────────────────────
// Renderiza un ítem de la agenda derivada según su tipo. Las citas y
// llamadas vienen del estado real del lead; las tareas son manuales.

function AgendaRow({
  item, isPending, onRegisterCall, onCompleteTask,
}: {
  item:           AgendaItem
  isPending:      boolean
  onRegisterCall: () => void
  onCompleteTask: () => void
}) {
  // ── Cita programada ──
  if (item.kind === 'appointment') {
    return (
      <div className={cn(
        'rounded-lg border px-2.5 py-1.5 flex items-center gap-2',
        item.overdue ? 'border-amber-300 bg-amber-50/60' : 'border-violet-200 bg-violet-50/50',
      )}>
        <CalendarCheck className={cn('size-3 shrink-0', item.overdue ? 'text-amber-600' : 'text-violet-600')} />
        <span className={cn('text-[11px] font-semibold', item.overdue ? 'text-amber-800' : 'text-violet-800')}>
          Cita · {APPOINTMENT_TIPO_LABEL[item.tipo]}
        </span>
        <span className={cn('text-[11px] ml-auto shrink-0', item.overdue ? 'text-amber-700/80' : 'text-violet-700/80')}>
          {fmtAgendaWhen(item.date)}{item.lugar ? ` · ${item.lugar}` : ''}
        </span>
        {item.overdue && (
          <span className="text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200/60 rounded-full px-1.5 py-0.5 shrink-0">
            Vencida
          </span>
        )}
      </div>
    )
  }

  // ── Llamada pendiente ──
  if (item.kind === 'call') {
    return (
      <div className={cn(
        'rounded-lg border px-2.5 py-1.5 flex items-center gap-2',
        item.overdue ? 'border-destructive/40 bg-destructive-soft' : 'border-sky-200 bg-sky-50/50',
      )}>
        {item.overdue
          ? <AlertTriangle className="size-3 text-destructive shrink-0" />
          : <Clock3 className="size-3 text-sky-600 shrink-0" />}
        <span className={cn('text-[11px] font-semibold truncate',
          item.overdue ? 'text-destructive' : 'text-sky-700')}>
          {item.overdue ? 'Llamada vencida' : 'Llamada'} · {fmtAgendaWhen(item.date)}
          {item.notas ? ` — ${item.notas}` : ''}
        </span>
        <Button
          size="sm" variant="outline"
          className={cn('h-5 px-2 text-[10px] gap-1 shrink-0 ml-auto',
            item.overdue ? 'text-destructive border-destructive/40 hover:bg-destructive/10'
              : 'text-sky-700 border-sky-300 hover:bg-sky-100')}
          onClick={onRegisterCall}
          disabled={isPending}
        >
          <PhoneCall className="size-2.5" />Registrar
        </Button>
      </div>
    )
  }

  // ── Tarea manual ──
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
      <button onClick={onCompleteTask} className="shrink-0" disabled={isPending} title="Marcar como hecha">
        <Circle className="size-3.5 text-muted-foreground hover:text-primary transition-colors" />
      </button>
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <div className="text-[11px]">{item.texto}</div>
        {item.date && (
          <div className="text-[10px] text-muted-foreground shrink-0">{fmtAgendaWhen(item.date)}</div>
        )}
      </div>
      <Button
        size="sm" variant="ghost" className="h-7 text-xs"
        onClick={onCompleteTask}
        disabled={isPending}
      >
        Hecho
      </Button>
    </div>
  )
}

// ── TransferDialog ─────────────────────────────────────────────────────────────

function TransferDialog({
  open, onOpenChange, leadId, leadNombre, assignedTo, vendedores, onDone,
}: {
  open:         boolean
  onOpenChange: (v: boolean) => void
  leadId:       string
  leadNombre:   string
  assignedTo:   string | null
  vendedores:   Vendedor[]
  onDone:       () => void
}) {
  const [toUserId,   setToUserId]   = useState('')
  const [motivo,     setMotivo]     = useState('')
  const [isPending,  startTransition] = useTransition()

  // Exclude the currently assigned user from the picker
  const candidates = vendedores.filter((v) => v.user_id !== assignedTo)

  function handleSubmit() {
    if (!toUserId) { toast.error('Seleccioná un vendedor'); return }
    startTransition(async () => {
      const res = await requestTransfer({
        leadId,
        toUserId,
        motivo: motivo.trim() || undefined,
      })
      if (!res.success) { toast.error(res.error); return }
      toast.success('Solicitud de traspaso enviada')
      setToUserId('')
      setMotivo('')
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setToUserId(''); setMotivo('') }; onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-indigo-600" />
            Transferir lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Seleccioná el vendedor al que querés transferir a{' '}
            <span className="font-semibold text-foreground">{leadNombre}</span>.
            El receptor recibirá una notificación y deberá aceptar.
          </p>

          <div className="space-y-1.5">
            <Label>Vendedor *</Label>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No hay otros vendedores disponibles para el traspaso.
              </p>
            ) : (
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((v) => (
                    <SelectItem key={v.user_id} value={v.user_id}>
                      {v.alias || v.nombre || v.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea
              placeholder="Ej: El cliente está en mi zona de cobertura"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!toUserId || candidates.length === 0 || isPending}
            className="gap-1.5"
          >
            {isPending
              ? <Loader2 className="size-4 animate-spin" />
              : <ArrowRightLeft className="size-4" />}
            Solicitar traspaso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── ReassignDialog ────────────────────────────────────────────────────────────
// Para supervisor+: reasigna el lead al instante (sin aprobación), a un vendedor
// de su alcance o a la Bandeja General.

const SIN_ASIGNAR = '__none__'

function ReassignDialog({
  open, onOpenChange, leadId, leadNombre, assignedTo, vendedores, onDone,
}: {
  open:         boolean
  onOpenChange: (v: boolean) => void
  leadId:       string
  leadNombre:   string
  assignedTo:   string | null
  vendedores:   Vendedor[]
  onDone:       () => void
}) {
  const [toUserId,  setToUserId]      = useState('')
  const [isPending, startTransition]  = useTransition()

  // No ofrecer al vendedor ya asignado
  const candidates = vendedores.filter((v) => v.user_id !== assignedTo)

  function handleSubmit() {
    if (!toUserId) { toast.error('Seleccioná una opción'); return }
    const target = toUserId === SIN_ASIGNAR ? null : toUserId
    startTransition(async () => {
      const res = await assignLead(leadId, target)
      if (!res.success) { toast.error(res.error); return }
      toast.success(target ? 'Lead reasignado' : 'Lead enviado a Bandeja General')
      setToUserId('')
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setToUserId(''); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="size-4 text-indigo-600" />
            Reasignar lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Elegí a quién asignar{' '}
            <span className="font-semibold text-foreground">{leadNombre}</span>.
            El cambio es inmediato, no requiere aprobación.
          </p>

          <div className="space-y-1.5">
            <Label>Asignar a *</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((v) => (
                  <SelectItem key={v.user_id} value={v.user_id}>
                    {v.alias || v.nombre || v.user_id}
                  </SelectItem>
                ))}
                <SelectItem value={SIN_ASIGNAR}>
                  <span className="text-muted-foreground italic">Sin asignar (Bandeja General)</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!toUserId || isPending}
            className="gap-1.5"
          >
            {isPending
              ? <Loader2 className="size-4 animate-spin" />
              : <UserCheck className="size-4" />}
            Reasignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── CallCard ──────────────────────────────────────────────────────────────────

type LeadCall = {
  id:              string
  scheduled_at:    string | Date
  notas_previas:   string | null
  realizada_at:    string | Date | null
  canceled_at:     string | Date | null
  outcome:         string | null
  notas_resultado: string | null
}

const OUTCOME_LABEL: Record<string, { label: string; color: string }> = {
  no_contesto:     { label: 'No contestó',              color: 'text-amber-600'   },
  sin_avance:      { label: 'Atendió — sin avance',     color: 'text-slate-600'   },
  proxima_llamada: { label: 'Próxima llamada agendada', color: 'text-sky-600'     },
  cita:            { label: 'Cita acordada',            color: 'text-violet-600'  },
  descartado:      { label: 'Lead dado de baja',        color: 'text-rose-600'    },
}

function CallCard({ call, onRegister }: { call: LeadCall; onRegister: () => void }) {
  const isCanceled = !!call.canceled_at
  const isPending  = !call.realizada_at && !isCanceled
  const fecha = format(new Date(call.scheduled_at), 'dd/MM HH:mm')
  // Pendiente y su hora ya pasó → vencida, hay que registrarla.
  const isOverdue = isPending && new Date(call.scheduled_at).getTime() < Date.now()

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-1',
      isCanceled ? 'border-border bg-muted/10 opacity-60'
        : isOverdue ? 'border-destructive/40 bg-destructive-soft'
        : isPending ? 'border-sky-200 bg-sky-50/50'
        : 'border-border bg-muted/20',
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isCanceled
            ? <PhoneOff className="size-3.5 text-muted-foreground shrink-0" />
            : isOverdue
            ? <AlertTriangle className="size-3.5 text-destructive shrink-0" />
            : isPending
            ? <Clock3 className="size-3.5 text-sky-600 shrink-0" />
            : <PhoneIncoming className="size-3.5 text-teal-600 shrink-0" />}
          <span className={cn('text-xs font-medium',
            isCanceled ? 'text-muted-foreground line-through'
              : isOverdue ? 'text-destructive'
              : isPending ? 'text-sky-700'
              : 'text-muted-foreground')}>
            {isCanceled ? `Cancelada · ${fecha}`
              : isOverdue ? `Vencida · ${fecha}`
              : isPending ? `Pendiente · ${fecha}`
              : `Realizada · ${fecha}`}
          </span>
        </div>
        {isPending && (
          <Button
            size="sm" variant="outline"
            className={cn('h-6 px-2 text-[11px] gap-1',
              isOverdue ? 'text-destructive border-destructive/40 hover:bg-destructive/10'
                : 'text-sky-700 border-sky-300 hover:bg-sky-100')}
            onClick={onRegister}
          >
            <PhoneCall className="size-3" />Registrar llamada
          </Button>
        )}
      </div>

      {call.notas_previas && (
        <p className="text-xs text-muted-foreground pl-5">{call.notas_previas}</p>
      )}

      {!isPending && call.outcome && (
        <div className="pl-5 space-y-0.5">
          <span className={cn('text-xs font-medium', OUTCOME_LABEL[call.outcome]?.color)}>
            {OUTCOME_LABEL[call.outcome]?.label ?? call.outcome}
          </span>
          {call.notas_resultado && (
            <p className="text-xs text-muted-foreground">{call.notas_resultado}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── ScheduleCallDialog ────────────────────────────────────────────────────────

function ScheduleCallDialog({
  open, onOpenChange, leadId, onDone,
}: {
  open:         boolean
  onOpenChange: (v: boolean) => void
  leadId:       string
  onDone:       () => void
}) {
  const [scheduledAt,  setScheduledAt]  = useState('')
  const [notas,        setNotas]        = useState('')
  const [isPending,    startTransition] = useTransition()

  function reset() { setScheduledAt(''); setNotas('') }

  // Default: mañana a las 10:00 (formato datetime-local)
  useEffect(() => {
    if (open && !scheduledAt) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(10, 0, 0, 0)
      setScheduledAt(tomorrow.toISOString().slice(0, 16))
    }
  }, [open])

  function handleSubmit() {
    if (!scheduledAt) { toast.error('Indicá la fecha y hora de la llamada'); return }
    startTransition(async () => {
      const res = await scheduleCall({
        leadId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notasPrevias: notas.trim() || undefined,
      })
      if (!res.success) { toast.error(res.error); return }
      toast.success(
        res.data.replacedPending > 0
          ? 'Llamada reagendada — se canceló la anterior pendiente'
          : 'Llamada agendada',
      )
      reset()
      onDone()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="size-4 text-sky-600" />
            Agendar llamada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Fecha y hora *</Label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Contexto / notas previas <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea
              placeholder="Ej: Interesado en Tracker, consultar por financiamiento"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!scheduledAt || isPending} className="gap-1.5">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <PhoneCall className="size-4" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── RegisterCallDialog ────────────────────────────────────────────────────────

type CallOutcome = 'no_contesto' | 'sin_avance' | 'proxima_llamada' | 'cita' | 'descartado'

// Los 4 resultados "activos" (el lead sigue vivo) se muestran en grilla.
// "Dar de baja" va aparte, como salida.
const OUTCOMES: { value: CallOutcome; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  {
    value:  'cita',
    label:  'Agendar cita',
    desc:   'Se pactó una cita',
    icon:   <CalendarCheck className="size-4" />,
    color:  'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
  {
    value:  'proxima_llamada',
    label:  'Próxima llamada',
    desc:   'Quedaron en hablar con fecha',
    icon:   <PhoneCall className="size-4" />,
    color:  'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100',
  },
  {
    value:  'sin_avance',
    label:  'Sin avance',
    desc:   'Atendió, pero sin paso concreto',
    icon:   <MinusCircle className="size-4" />,
    color:  'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100',
  },
  {
    value:  'no_contesto',
    label:  'No contestó',
    desc:   'No atendió la llamada',
    icon:   <PhoneOff className="size-4" />,
    color:  'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
]

const OUTCOME_BAJA: { value: CallOutcome; label: string; desc: string; icon: React.ReactNode; color: string } = {
  value:  'descartado',
  label:  'Dar de baja',
  desc:   'El lead no sigue adelante',
  icon:   <X className="size-4" />,
  color:  'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100',
}

type ApptTipo = 'videollamada' | 'visita_showroom' | 'cierre'

const APPT_TIPO_OPTIONS: {
  value:         ApptTipo
  label:         string
  desc:          string
  icon:          React.ReactNode
  selectedClass: string
}[] = [
  {
    value:         'videollamada',
    label:         'Videollamada',
    desc:          'Reunión virtual',
    icon:          <Video className="size-4" />,
    selectedClass: 'border-sky-400 text-sky-700 bg-sky-50/60 ring-sky-400',
  },
  {
    value:         'visita_showroom',
    label:         'Showroom',
    desc:          'El cliente viene',
    icon:          <Building2 className="size-4" />,
    selectedClass: 'border-violet-400 text-violet-700 bg-violet-50/60 ring-violet-400',
  },
  {
    value:         'cierre',
    label:         'Cierre',
    desc:          'Confirmar venta',
    icon:          <Handshake className="size-4" />,
    selectedClass: 'border-emerald-400 text-emerald-700 bg-emerald-50/60 ring-emerald-400',
  },
]

const APPT_DURATIONS = [30, 60, 90, 120] as const

// Intentos de "no contestó" antes de sugerir dar de baja como "NO CONTESTA".
const MAX_UNANSWERED = 3

function RegisterCallDialog({
  open, callId, leadId, unansweredSoFar = 0, onOpenChange, onDone,
}: {
  open:            boolean
  callId?:         string          // registrar una llamada YA agendada
  leadId?:         string          // registrar una llamada ad-hoc (la crea)
  unansweredSoFar?: number         // racha de "no contestó" previa de este lead
  onOpenChange:    (v: boolean) => void
  onDone:          (outcome: CallOutcome, unansweredStreak?: number) => void
}) {
  const isAdHoc = !callId && !!leadId
  // Número de intento que representaría esta llamada si es "no contestó", y si
  // todavía estamos dentro de los intentos sugeridos (≤ MAX) o ya conviene baja.
  const attemptNumber  = unansweredSoFar + 1
  const withinAttempts = attemptNumber < MAX_UNANSWERED
  const [outcome,    setOutcome]    = useState<CallOutcome | null>(null)
  const [notas,      setNotas]      = useState('')
  const [nextCallAt, setNextCallAt] = useState('')
  // Reintento opcional para no_contesto (separado de nextCallAt para que el
  // default de "próxima llamada" no se cuele como reintento involuntario).
  const [retryAt,    setRetryAt]    = useState('')
  // Campos de cita (solo se usan si outcome === 'cita')
  const [apptAt,     setApptAt]     = useState('')
  const [apptTipo,   setApptTipo]   = useState<ApptTipo>('videollamada')
  const [apptDur,    setApptDur]    = useState<number>(60)
  const [apptLugar,  setApptLugar]  = useState('')
  const [isPending,  startTransition] = useTransition()

  // Defaults al abrir el dialog: próxima llamada en 3 días, cita en 2 días
  useEffect(() => {
    if (!open) return
    if (!nextCallAt) {
      const d = new Date()
      d.setDate(d.getDate() + 3)
      d.setHours(10, 0, 0, 0)
      setNextCallAt(d.toISOString().slice(0, 16))
    }
    if (!apptAt) {
      const d = new Date()
      d.setDate(d.getDate() + 2)
      d.setHours(11, 0, 0, 0)
      setApptAt(d.toISOString().slice(0, 16))
    }
  }, [open])

  function reset() {
    setOutcome(null); setNotas(''); setNextCallAt(''); setRetryAt('')
    setApptAt(''); setApptTipo('videollamada'); setApptDur(60); setApptLugar('')
  }

  // Al elegir el resultado: si es "no contestó" y todavía estamos dentro de los
  // intentos, sugerimos un reintento pre-cargando una fecha (mañana 10:00). El
  // vendedor puede quitarla. Pasados los intentos no lo pre-cargamos (la idea
  // ahí es dar de baja, no insistir).
  function handleSelectOutcome(v: CallOutcome) {
    setOutcome(v)
    if (v === 'no_contesto' && withinAttempts && !retryAt) {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(10, 0, 0, 0)
      setRetryAt(d.toISOString().slice(0, 16))
    }
  }

  // Validez del submit según outcome. no_contesto y sin_avance no exigen campos.
  const submitDisabled =
    !outcome ||
    (outcome === 'proxima_llamada' && !nextCallAt) ||
    (outcome === 'cita' && (!apptAt || (apptTipo === 'visita_showroom' && !apptLugar.trim()))) ||
    isPending

  function handleSubmit() {
    if (!outcome) { toast.error('Seleccioná qué pasó en la llamada'); return }
    if (outcome === 'proxima_llamada' && !nextCallAt) {
      toast.error('Indicá la fecha de la próxima llamada')
      return
    }
    if (outcome === 'cita' && !apptAt) {
      toast.error('Indicá la fecha de la cita')
      return
    }

    startTransition(async () => {
      // proximaLlamadaAt se manda para proxima_llamada (obligatorio, usa
      // nextCallAt) y para no_contesto si el vendedor cargó un reintento
      // opcional (usa retryAt).
      const nextCallISO =
        outcome === 'proxima_llamada' && nextCallAt ? new Date(nextCallAt).toISOString()
        : outcome === 'no_contesto' && retryAt      ? new Date(retryAt).toISOString()
        : undefined

      const res = await registerCall({
        ...(callId ? { callId } : { leadId }),
        outcome,
        notasResultado:   notas.trim() || undefined,
        proximaLlamadaAt: nextCallISO,
        appointment: outcome === 'cita'
          ? {
              scheduled_at: new Date(apptAt).toISOString(),
              tipo:         apptTipo,
              duration_min: apptDur,
              lugar:        apptLugar.trim() || undefined,
            }
          : undefined,
      })
      if (!res.success) { toast.error(res.error); return }

      const labels: Record<CallOutcome, string> = {
        no_contesto:     retryAt ? 'Llamada registrada — reintento agendado' : 'Llamada registrada — no contestó',
        sin_avance:      'Llamada registrada — sigue en gestión',
        proxima_llamada: 'Llamada registrada — próxima llamada agendada',
        cita:            'Llamada registrada — cita agendada',
        descartado:      'Llamada registrada',
      }
      toast.success(labels[outcome])
      if (res.data.replacedPending > 0) {
        toast.info('Se canceló la llamada pendiente anterior')
      }
      reset()
      onDone(outcome, res.data.unansweredStreak)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneIncoming className="size-4 text-teal-600" />
            Registrar llamada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {isAdHoc && (
            <p className="text-[11px] text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
              Registrás una llamada que ya hiciste. Elegí en qué quedó para definir el próximo paso.
            </p>
          )}
          {/* Outcome selector */}
          <div className="space-y-2">
            <Label>¿En qué quedamos? *</Label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => handleSelectOutcome(o.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 text-center transition-all',
                    outcome === o.value
                      ? o.color + ' ring-2 ring-offset-1 ring-current'
                      : 'border-border hover:border-muted-foreground/40',
                  )}
                >
                  <span className={outcome === o.value ? '' : 'text-muted-foreground'}>{o.icon}</span>
                  <span className={cn('text-xs font-semibold leading-tight', outcome !== o.value && 'text-foreground')}>
                    {o.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                    {o.desc}
                  </span>
                </button>
              ))}
            </div>
            {/* Salida: dar de baja (separada de los resultados activos) */}
            <button
              type="button"
              onClick={() => handleSelectOutcome(OUTCOME_BAJA.value)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-center transition-all',
                outcome === OUTCOME_BAJA.value
                  ? OUTCOME_BAJA.color + ' ring-2 ring-offset-1 ring-current'
                  : 'border-border hover:border-muted-foreground/40',
              )}
            >
              <span className={outcome === OUTCOME_BAJA.value ? '' : 'text-muted-foreground'}>{OUTCOME_BAJA.icon}</span>
              <span className={cn('text-xs font-semibold', outcome !== OUTCOME_BAJA.value && 'text-foreground')}>
                {OUTCOME_BAJA.label}
              </span>
              <span className="text-[10px] text-muted-foreground hidden sm:block">— {OUTCOME_BAJA.desc}</span>
            </button>
          </div>

          {/* No contestó — dentro de los intentos: sugerir reintento.
              Pasados los intentos: avisar que conviene dar de baja. */}
          {outcome === 'no_contesto' && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <PhoneOff className="size-3.5" />
                No atendió — intento {attemptNumber}
              </div>

              {withinAttempts ? (
                <>
                  <p className="text-[11px] text-amber-700/80 leading-snug">
                    Se registra el intento. El lead sigue en su etapa y cuenta como demorado hasta
                    que lo contactes. Te sugerimos <b>programar un reintento</b> ahora.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reintentar llamada</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={retryAt}
                        onChange={(e) => setRetryAt(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      {retryAt && (
                        <button
                          type="button"
                          onClick={() => setRetryAt('')}
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          title="Quitar reintento"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-amber-700/60">Opcional — podés quitarlo si preferís no reagendar.</p>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-amber-800 leading-snug">
                  Van {attemptNumber} intentos sin respuesta. Registrá este y, si seguís sin
                  llegar, conviene <b>darlo de baja como “NO CONTESTA”</b> (se puede rescatar luego).
                  Te lo vamos a sugerir al confirmar.
                </p>
              )}
            </div>
          )}

          {/* Sin avance — info */}
          {outcome === 'sin_avance' && (
            <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 leading-snug">
              Atendió pero no se llegó a un paso concreto. Cuenta como contacto (se reinicia el reloj
              de seguimiento) y el lead sigue activo <b>en gestión</b>.
            </p>
          )}

          {/* Próxima llamada */}
          {outcome === 'proxima_llamada' && (
            <div className="space-y-1.5">
              <Label>Fecha y hora de la próxima llamada *</Label>
              <input
                type="datetime-local"
                value={nextCallAt}
                onChange={(e) => setNextCallAt(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}

          {/* Agendar cita inline — datos obligatorios */}
          {outcome === 'cita' && (
            <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                <CalendarCheck className="size-3.5" />
                Datos de la cita
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Fecha y hora *</Label>
                  <input
                    type="datetime-local"
                    value={apptAt}
                    onChange={(e) => setApptAt(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Tipo *</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {APPT_TIPO_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setApptTipo(t.value)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border-2 px-1.5 py-2 text-center transition-all',
                          apptTipo === t.value
                            ? `${t.selectedClass} ring-2 ring-offset-1 ring-current`
                            : 'border-border hover:border-muted-foreground/40',
                        )}
                      >
                        <span className={apptTipo === t.value ? '' : 'text-muted-foreground'}>{t.icon}</span>
                        <span className={cn('text-[11px] font-semibold leading-tight', apptTipo !== t.value && 'text-foreground')}>
                          {t.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
                          {t.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Duración</Label>
                  <Select value={String(apptDur)} onValueChange={(v) => setApptDur(Number(v))}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPT_DURATIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(apptTipo === 'visita_showroom' || apptTipo === 'cierre') && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">
                      Lugar {apptTipo === 'visita_showroom' && '*'}
                    </Label>
                    <Input
                      value={apptLugar}
                      onChange={(e) => setApptLugar(e.target.value)}
                      placeholder="Ej: Showroom Av. Cabildo"
                      className="h-9 text-sm"
                    />
                  </div>
                )}
              </div>

              <p className="text-[11px] text-violet-700/80 leading-snug">
                Al confirmar se registra la llamada <b>y se agenda la cita</b> en un solo paso.
                El lead pasa a <b>Entrevista Pactada</b>.
              </p>
            </div>
          )}

          {/* Notas del resultado */}
          <div className="space-y-1.5">
            <Label>
              Notas de la llamada
              <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
            </Label>
            <Textarea
              placeholder="Ej: Está comparando con Toyota, vuelve a llamar el jueves..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {outcome === 'descartado' && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              Al confirmar, se abrirá el formulario para dar de baja el lead con motivo.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitDisabled}
            className="gap-1.5"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
