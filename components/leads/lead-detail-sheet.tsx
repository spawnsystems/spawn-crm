'use client'

import { useState, useTransition, useEffect } from 'react'
import { format } from 'date-fns'
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
  ArrowRightLeft, PhoneCall, PhoneIncoming, Clock3,
} from 'lucide-react'
import {
  addNote, toggleTask, getLeadDetail,
  updateLead, addTask, assignLead,
} from '@/app/actions/leads'
import { requestTransfer } from '@/app/actions/transfers'
import { scheduleCall, registerCall } from '@/app/actions/calls'
import { BajaDialog } from '@/components/leads/baja-dialog'
import { CotizadorDialog } from '@/components/cotizador/cotizador-dialog'
import { getNextAppointmentForLead } from '@/app/actions/appointments'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { leadSourceValues } from '@/lib/schemas/leads'
import { isBaja } from '@/lib/leads/constants'
import { useCurrentUser } from '@/lib/tenant/context'
import type { Lead } from '@/lib/db'
import { cn, parseNumeric, safeRefetch, fmtDayMonthAR, toBADate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────

type DetailData   = Awaited<ReturnType<typeof getLeadDetail>>
type Vendedor     = Awaited<ReturnType<typeof getVendedoresDelTenant>>[number]
// getNextAppointmentForLead returns rows[0] which may be undefined at runtime
// even though TS infers the non-nullable element type; we always allow null.
type Appointment  = Awaited<ReturnType<typeof getNextAppointmentForLead>> | null

// ── Timeline event styles ─────────────────────────────────────────

type EventStyle = { bg: string; Icon: React.FC<{ className?: string }> }

const TIMELINE_EVENT_STYLE: Record<string, EventStyle> = {
  lead_created:            { bg: 'bg-slate-500',   Icon: UserPlus      },
  contacted:               { bg: 'bg-blue-500',    Icon: Phone         },
  status_changed:          { bg: 'bg-primary',     Icon: ArrowRight    },
  reassigned:              { bg: 'bg-indigo-500',  Icon: UserCheck     },
  note_added:              { bg: 'bg-slate-400',   Icon: FileText      },
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
  _default:                { bg: 'bg-muted-foreground', Icon: ArrowRight    },
}

// ── Main component ────────────────────────────────────────────────

interface LeadDetailSheetProps {
  leadId:          string | null
  onClose:         () => void
  onStatusChange?: (leadId: string, status: string) => void
}

export function LeadDetailSheet({ leadId, onClose, onStatusChange }: LeadDetailSheetProps) {
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
  const [showBaja,        setShowBaja]        = useState(false)
  const [showCotizador,   setShowCotizador]   = useState(false)
  const [showTransfer,    setShowTransfer]    = useState(false)
  const [showScheduleCall, setShowScheduleCall] = useState(false)
  const [registerCallId,   setRegisterCallId]   = useState<string | null>(null)
  const [showTimelineDialog, setShowTimelineDialog] = useState(false)
  const [isPending,       startTransition]    = useTransition()

  // Fetch all data when sheet opens.
  // `cancelled` flag prevents stale updates on quick open/close.
  useEffect(() => {
    if (!leadId) { setDetail(null); setNextAppointment(null); setEditing(false); return }
    setLoading(true)
    let cancelled = false

    Promise.all([
      getLeadDetail(leadId),
      getNextAppointmentForLead(leadId),
      getVendedoresDelTenant(),
    ])
      .then(([d, appt, v]) => {
        if (cancelled) return
        setDetail(d)
        setNextAppointment(appt)
        setVendedores(v)
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
  const notes           = detail?.notes          ?? []
  const timeline        = detail?.timeline        ?? []
  const tasks           = detail?.tasks           ?? []
  const calls           = detail?.calls           ?? []

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

  // ── Mutations ──────────────────────────────────────────────────

  function handleToggleTask(taskId: string, done: boolean) {
    startTransition(async () => {
      const res = await toggleTask(taskId, done)
      if (res.success) {
        setDetail((d) => d
          ? { ...d, tasks: d.tasks.map((t) => t.id === taskId ? { ...t, done } : t) }
          : d)
      } else {
        toast.error(res.error)
      }
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
    startTransition(async () => {
      const res = await updateLead(lead.id, {
        nombre:      editForm.nombre,
        telefono:    editForm.telefono ?? undefined,
        email:       editForm.email    ?? undefined,
        modelo:      editForm.modelo   ?? undefined,
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

  function handleAssign(vendedorId: string | null) {
    if (!lead) return
    startTransition(async () => {
      const res = await assignLead(lead.id, vendedorId)
      if (res.success) {
        setDetail((d) => d ? { ...d, lead: { ...d.lead, assigned_to: vendedorId } } : d)
        toast.success(vendedorId ? 'Lead asignado' : 'Lead enviado a Bandeja General')
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
                    <button
                      onClick={() => setEditing((v) => !v)}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground ml-auto sm:ml-0"
                      title="Editar lead"
                    >
                      {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
                    </button>
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
                    {detail?.lead.creator_nombre && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/70">
                        <UserPlus className="size-3" />
                        Cargado por <span className="font-medium text-foreground/70">{detail.lead.creator_nombre}</span>
                      </span>
                    )}
                  </div>

                  {/* Model + Status (la etapa avanza con las acciones, no se edita a mano) */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Car className="size-4 text-primary" />
                    <span className="font-medium">{lead.modelo ?? 'Sin modelo'}</span>
                    <StatusBadge status={lead.status} />
                  </div>

                  {/* Vendedor asignado */}
                  {currentUser.rol === 'vendedor' ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserCircle className="size-3.5 shrink-0" />
                      <span>Asignado a vos</span>
                    </div>
                  ) : vendedores.length > 0 ? (
                    <div className="mt-2 flex items-center gap-1.5">
                      <UserCircle className="size-3.5 text-muted-foreground shrink-0" />
                      <Select
                        value={lead.assigned_to ?? '__none__'}
                        onValueChange={(v) => handleAssign(v === '__none__' ? null : v)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="h-7 text-xs w-48 border-dashed">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground italic">Sin asignar</span>
                          </SelectItem>
                          {vendedores.map((v) => {
                            const name = v.alias || v.nombre || v.user_id
                            return (
                              <SelectItem key={v.user_id} value={v.user_id}>
                                {name}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
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
                  {/* Transferir — solo si el lead aún está activo */}
                  {!isBaja(lead.status) && lead.status !== 'VENTA' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200 mt-1"
                      onClick={() => setShowTransfer(true)}
                      title="Transferir este lead a otro vendedor"
                    >
                      <ArrowRightLeft className="size-3.5" />
                      Transferir
                    </Button>
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

            {/* ── Next action card ── */}
            <div className="pt-4">
              <NextActionCard
                lead={lead}
                nextAppointment={nextAppointment}
                onLeadUpdated={refreshAll}
              />
            </div>

            {/* ── Cotizador de usado ── */}
            {lead.tiene_usado && (
              <div className="mx-6 mb-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-800">Tiene auto para dar en parte de pago</p>
                  <p className="text-xs text-amber-700/60 mt-0.5">Calculá el valor de toma con las reglas InfoAuto.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => setShowCotizador(true)}
                >
                  Cotizar usado
                </Button>
              </div>
            )}

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
                    <Label className="text-xs">Modelo</Label>
                    <Input
                      value={editForm.modelo ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, modelo: e.target.value }))}
                      placeholder="Ej: Tracker Premier"
                      className="h-8 text-sm"
                    />
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
                          <SelectItem key={s} value={s}>{s}</SelectItem>
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

                {/* Tasks */}
                <Section icon={<CalendarIcon className="size-4" />} title="Próximas acciones">
                  {tasks.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 rounded-lg border border-border p-3"
                        >
                          <button
                            onClick={() => handleToggleTask(t.id, !t.done)}
                            className="shrink-0"
                            disabled={isPending}
                          >
                            {t.done
                              ? <CheckCircle2 className="size-4 text-success" />
                              : <Circle className="size-4 text-muted-foreground hover:text-primary transition-colors" />}
                          </button>
                          <div className="flex-1">
                            <div className={cn('text-sm', t.done && 'line-through text-muted-foreground')}>
                              {t.texto}
                            </div>
                            {t.due_at && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {fmtDayMonthAR(t.due_at)}
                              </div>
                            )}
                          </div>
                          {!t.done && (
                            <Button
                              size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => handleToggleTask(t.id, true)}
                              disabled={isPending}
                            >
                              Hecho
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add task — with optional due date */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nueva tarea..."
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
                </Section>

                {/* Llamadas */}
                <Section icon={<PhoneCall className="size-4" />} title="Llamadas">
                  {calls.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {calls.map((call) => (
                        <CallCard
                          key={call.id}
                          call={call}
                          onRegister={() => setRegisterCallId(call.id)}
                        />
                      ))}
                    </div>
                  )}
                  {calls.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-3">Sin llamadas coordinadas.</p>
                  )}
                  {!isBaja(lead.status) && lead.status !== 'VENTA' && (
                    <Button
                      size="sm" variant="outline"
                      className="w-full gap-1.5 text-sky-600 hover:text-sky-700 hover:bg-sky-50 border-sky-200"
                      onClick={() => setShowScheduleCall(true)}
                    >
                      <PhoneCall className="size-3.5" />Agendar llamada
                    </Button>
                  )}
                </Section>

                {/* Notes */}
                <Section icon={<FileText className="size-4" />} title="Notas internas">
                  <div className="space-y-2 mb-3">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded-lg border border-border p-3 bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">
                          {n.autor ?? 'Usuario'} ·{' '}
                          {fmtDayMonthAR(n.created_at)}
                        </div>
                        <div className="text-sm">{n.texto}</div>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className="text-sm text-muted-foreground">Sin notas aún.</p>
                    )}
                  </div>
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
                    <TimelineList events={timeline.slice(0, 5)} />
                    {timeline.length > 5 && (
                      <button
                        onClick={() => setShowTimelineDialog(true)}
                        className="mt-1 text-xs text-primary hover:underline"
                      >
                        Ver todos ({timeline.length - 5} más)
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
              open={!!registerCallId}
              callId={registerCallId ?? ''}
              onOpenChange={(v) => { if (!v) setRegisterCallId(null) }}
              onDone={(outcome) => {
                setRegisterCallId(null)
                refreshAll()
                if (outcome === 'descartado') setShowBaja(true)
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
              onOpenChange={setShowCotizador}
              leadId={lead.id}
              leadNombre={lead.nombre}
              provincia={lead.provincia ?? undefined}
              onCreated={() => setShowCotizador(false)}
            />

            {/* ── Transfer dialog ── */}
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
                No hay otros vendedores disponibles en el tenant.
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

// ── CallCard ──────────────────────────────────────────────────────────────────

type LeadCall = {
  id:              string
  scheduled_at:    string | Date
  notas_previas:   string | null
  realizada_at:    string | Date | null
  outcome:         string | null
  notas_resultado: string | null
}

const OUTCOME_LABEL: Record<string, { label: string; color: string }> = {
  proxima_llamada: { label: 'Próxima llamada agendada', color: 'text-sky-600'     },
  cita:            { label: 'Cita acordada',            color: 'text-violet-600'  },
  descartado:      { label: 'Lead dado de baja',        color: 'text-rose-600'    },
}

function CallCard({ call, onRegister }: { call: LeadCall; onRegister: () => void }) {
  const isPending = !call.realizada_at
  const fecha = format(new Date(call.scheduled_at), 'dd/MM HH:mm')

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-1',
      isPending ? 'border-sky-200 bg-sky-50/50' : 'border-border bg-muted/20',
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isPending
            ? <Clock3 className="size-3.5 text-sky-600 shrink-0" />
            : <PhoneIncoming className="size-3.5 text-teal-600 shrink-0" />}
          <span className={cn('text-xs font-medium', isPending ? 'text-sky-700' : 'text-muted-foreground')}>
            {isPending ? `Pendiente · ${fecha}` : `Realizada · ${fecha}`}
          </span>
        </div>
        {isPending && (
          <Button
            size="sm" variant="outline"
            className="h-6 px-2 text-[11px] gap-1 text-sky-700 border-sky-300 hover:bg-sky-100"
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
      toast.success('Llamada agendada')
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

type CallOutcome = 'proxima_llamada' | 'cita' | 'descartado'

const OUTCOMES: { value: CallOutcome; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  {
    value:  'proxima_llamada',
    label:  'Próxima llamada',
    desc:   'Se coordina otra llamada',
    icon:   <PhoneCall className="size-4" />,
    color:  'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100',
  },
  {
    value:  'cita',
    label:  'Agendar cita',
    desc:   'Se pactó una cita presencial o virtual',
    icon:   <CalendarCheck className="size-4" />,
    color:  'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
  {
    value:  'descartado',
    label:  'Dar de baja',
    desc:   'El lead no sigue adelante',
    icon:   <X className="size-4" />,
    color:  'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100',
  },
]

function RegisterCallDialog({
  open, callId, onOpenChange, onDone,
}: {
  open:         boolean
  callId:       string
  onOpenChange: (v: boolean) => void
  onDone:       (outcome: CallOutcome) => void
}) {
  const [outcome,    setOutcome]    = useState<CallOutcome | null>(null)
  const [notas,      setNotas]      = useState('')
  const [nextCallAt, setNextCallAt] = useState('')
  const [isPending,  startTransition] = useTransition()

  // Default próxima llamada: en 3 días a las 10:00
  useEffect(() => {
    if (open && !nextCallAt) {
      const d = new Date()
      d.setDate(d.getDate() + 3)
      d.setHours(10, 0, 0, 0)
      setNextCallAt(d.toISOString().slice(0, 16))
    }
  }, [open])

  function reset() { setOutcome(null); setNotas(''); setNextCallAt('') }

  function handleSubmit() {
    if (!outcome) { toast.error('Seleccioná qué pasó en la llamada'); return }
    if (outcome === 'proxima_llamada' && !nextCallAt) {
      toast.error('Indicá la fecha de la próxima llamada')
      return
    }

    startTransition(async () => {
      const res = await registerCall({
        callId,
        outcome,
        notasResultado:   notas.trim() || undefined,
        proximaLlamadaAt: outcome === 'proxima_llamada' ? new Date(nextCallAt).toISOString() : undefined,
      })
      if (!res.success) { toast.error(res.error); return }

      const labels: Record<CallOutcome, string> = {
        proxima_llamada: 'Llamada registrada — próxima llamada agendada',
        cita:            'Llamada registrada — recordá agendar la cita',
        descartado:      'Llamada registrada',
      }
      toast.success(labels[outcome])
      reset()
      onDone(outcome)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneIncoming className="size-4 text-teal-600" />
            Registrar llamada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Outcome selector */}
          <div className="space-y-2">
            <Label>¿En qué quedamos? *</Label>
            <div className="grid grid-cols-3 gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setOutcome(o.value)}
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
          </div>

          {/* Fecha próxima llamada (solo si se elige proxima_llamada) */}
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
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Aviso si el outcome desencadena otra acción */}
          {outcome === 'cita' && (
            <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
              Al confirmar, podrás agendar la cita desde la sección de próxima acción del lead.
            </p>
          )}
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
            disabled={
              !outcome ||
              (outcome === 'proxima_llamada' && !nextCallAt) ||
              isPending
            }
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
