'use client'

import { useState, useTransition, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Phone, Mail, Car, CheckCircle2, Circle, CalendarIcon, FileText,
  MessageCircle, Send, ChevronDown, Loader2, Pencil, X, Check,
  UserCircle, Plus, RotateCcw, UserPlus, UserCheck, ArrowRight,
  CalendarCheck, Trophy, LifeBuoy, AlertTriangle, CalendarX,
} from 'lucide-react'
import {
  changeStatus, addNote, toggleTask, getLeadDetail,
  updateLead, addTask, assignLead,
} from '@/app/actions/leads'
import { BajaDialog } from '@/components/leads/baja-dialog'
import { getNextAppointmentForLead } from '@/app/actions/appointments'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { leadSourceValues, activeStatusValues } from '@/lib/schemas/leads'
import { isBaja } from '@/lib/leads/constants'
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
  lead_baja:               { bg: 'bg-rose-500',    Icon: CalendarX     },
  _default:                { bg: 'bg-muted-foreground', Icon: ArrowRight },
}

// ── Main component ────────────────────────────────────────────────

interface LeadDetailSheetProps {
  leadId:          string | null
  onClose:         () => void
  onStatusChange?: (leadId: string, status: string) => void
}

export function LeadDetailSheet({ leadId, onClose, onStatusChange }: LeadDetailSheetProps) {
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

  const lead     = detail?.lead
  const notes    = detail?.notes    ?? []
  const timeline = detail?.timeline ?? []
  const tasks    = detail?.tasks    ?? []

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

  function handleStatusChange(newStatus: string) {
    if (!lead) return
    startTransition(async () => {
      const res = await changeStatus(lead.id, newStatus as Lead['status'])
      if (res.success) {
        setDetail((d) => d ? { ...d, lead: { ...d.lead, status: newStatus as Lead['status'] } } : d)
        setEditForm((f) => ({ ...f, status: newStatus as Lead['status'] }))
        onStatusChange?.(lead.id, newStatus)
        toast.success(`Estado: ${newStatus}`)
      } else {
        toast.error(res.error)
      }
    })
  }

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
                  </div>

                  {/* Model + Status dropdown */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Car className="size-4 text-primary" />
                    <span className="font-medium">{lead.modelo ?? 'Sin modelo'}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1 rounded-md hover:bg-accent px-1 py-0.5 transition-colors">
                          <StatusBadge status={lead.status} />
                          <ChevronDown className="size-3 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {activeStatusValues.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            className="gap-2"
                          >
                            <StatusBadge status={s} />
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Vendedor asignado */}
                  {vendedores.length > 0 && (
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
                  {/* Dar de baja — solo si el lead aún está activo */}
                  {!isBaja(lead.status) && lead.status !== 'VENTA' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 mt-1"
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
                  <div className="relative">
                    {/* línea vertical centrada bajo los íconos */}
                    <div className="absolute left-[9px] top-5 bottom-0 w-px bg-border" />
                    {timeline.map((e) => {
                      const { bg, Icon } = TIMELINE_EVENT_STYLE[e.event_type] ?? TIMELINE_EVENT_STYLE._default
                      return (
                        <div key={e.id} className="relative flex gap-3 pb-4">
                          {/* ícono en el eje de la línea, nunca superpuesto al texto */}
                          <div className={cn(
                            'relative z-10 shrink-0 size-[18px] rounded-full mt-0.5',
                            'ring-2 ring-background flex items-center justify-center text-white',
                            bg,
                          )}>
                            <Icon className="size-2.5" />
                          </div>
                          {/* contenido */}
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
                )}
              </div>
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
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────

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
