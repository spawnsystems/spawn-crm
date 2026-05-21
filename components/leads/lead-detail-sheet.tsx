'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/status-badge'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Phone, Mail, Car, CheckCircle2, Circle, Calendar, FileText,
  MessageCircle, Send, ChevronDown, Loader2, Pencil, X, Check,
  UserCircle, Plus,
} from 'lucide-react'
import {
  changeStatus, addNote, toggleTask, getLeadDetail, markContacted,
  updateLead, addTask, assignLead,
} from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { leadSourceValues } from '@/lib/schemas/leads'
import type { Lead } from '@/lib/db'

// ── Types ─────────────────────────────────────────────────────────

type DetailData  = Awaited<ReturnType<typeof getLeadDetail>>
type Vendedor    = Awaited<ReturnType<typeof getVendedoresDelTenant>>[number]

const STATUSES = [
  'Nuevo', 'Contactado', 'Cotizado', 'Test drive', 'Negociación', 'Cerrado', 'Perdido',
] as const

// ── Main component ────────────────────────────────────────────────

interface LeadDetailSheetProps {
  leadId: string | null
  onClose: () => void
  onStatusChange?: (leadId: string, status: string) => void
}

export function LeadDetailSheet({ leadId, onClose, onStatusChange }: LeadDetailSheetProps) {
  const [detail,    setDetail]    = useState<DetailData | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [newNote,   setNewNote]   = useState('')
  const [newTask,   setNewTask]   = useState('')
  const [editing,   setEditing]   = useState(false)
  const [editForm,  setEditForm]  = useState<Partial<Lead>>({})
  const [isPending, startTransition] = useTransition()

  // Fetch lead detail + vendedores when sheet opens
  useEffect(() => {
    if (!leadId) { setDetail(null); setEditing(false); return }
    setLoading(true)
    Promise.all([
      getLeadDetail(leadId),
      getVendedoresDelTenant(),
    ]).then(([d, v]) => {
      setDetail(d)
      setVendedores(v)
      if (d) setEditForm(d.lead)
    }).finally(() => setLoading(false))
  }, [leadId])

  const lead     = detail?.lead
  const notes    = detail?.notes    ?? []
  const timeline = detail?.timeline ?? []
  const tasks    = detail?.tasks    ?? []

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
    startTransition(async () => {
      const res = await addNote(lead.id, newNote.trim())
      if (res.success) {
        setNewNote('')
        getLeadDetail(lead.id).then(setDetail)
        toast.success('Nota guardada')
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleAddTask() {
    if (!lead || !newTask.trim()) return
    startTransition(async () => {
      const res = await addTask(lead.id, newTask.trim())
      if (res.success) {
        setNewTask('')
        getLeadDetail(lead.id).then(setDetail)
        toast.success('Tarea agregada')
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleMarkContacted() {
    if (!lead) return
    startTransition(async () => {
      const res = await markContacted(lead.id)
      if (res.success) {
        setDetail((d) => d ? { ...d, lead: { ...d.lead, at_risk: false, last_contact_critical: false } } : d)
        toast.success('Contacto registrado')
      } else {
        toast.error(res.error)
      }
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
        est_value:   editForm.est_value ? parseFloat(String(editForm.est_value)) : undefined,
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
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-0">
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
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-xl">{lead.nombre}</SheetTitle>
                    <button
                      onClick={() => setEditing((v) => !v)}
                      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Editar lead"
                    >
                      {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
                    </button>
                  </div>
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
                        {STATUSES.map((s) => (
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
                  {lead.at_risk && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-success/30 text-success hover:bg-success/10"
                      onClick={handleMarkContacted}
                      disabled={isPending}
                    >
                      Registrar contacto
                    </Button>
                  )}
                </div>
              </div>
            </SheetHeader>

            {/* ── Edit form ── */}
            {editing && (
              <div className="border-b border-border bg-muted/30 p-6">
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
                <Section icon={<Calendar className="size-4" />} title="Próximas acciones">
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
                            <div className={`text-sm ${t.done ? 'line-through text-muted-foreground' : ''}`}>
                              {t.texto}
                            </div>
                            {t.due_at && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {new Date(t.due_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
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
                  {/* Add task */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nueva tarea..."
                      className="h-8 text-sm"
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask() }}
                    />
                    <Button
                      size="sm" variant="outline" className="h-8 gap-1 shrink-0"
                      onClick={handleAddTask}
                      disabled={!newTask.trim() || isPending}
                    >
                      <Plus className="size-3.5" />Agregar
                    </Button>
                  </div>
                </Section>

                {/* Notes */}
                <Section icon={<FileText className="size-4" />} title="Notas internas">
                  <div className="space-y-2 mb-3">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded-lg border border-border p-3 bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">
                          {n.autor ?? 'Usuario'} ·{' '}
                          {new Date(n.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
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
                  <div className="relative pl-5">
                    <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                    {timeline.map((e) => (
                      <div key={e.id} className="relative pb-4">
                        <div className="absolute -left-[14px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-background" />
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(e.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}{' '}
                          {new Date(e.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm font-medium mt-0.5">{e.title}</div>
                        {e.description && (
                          <div className="text-xs text-muted-foreground">{e.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
