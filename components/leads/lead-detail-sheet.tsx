'use client'

import { useState, useTransition, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/status-badge'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Phone, Mail, Car, CheckCircle2, Circle, Calendar, FileText,
  MessageCircle, Send, ChevronDown, Loader2,
} from 'lucide-react'
import {
  changeStatus, addNote, toggleTask, getLeadDetail, markContacted,
} from '@/app/actions/leads'
import type { Lead } from '@/lib/db'

// ── Types ─────────────────────────────────────────────────────────

type DetailData = Awaited<ReturnType<typeof getLeadDetail>>

const STATUSES = [
  'Nuevo', 'Contactado', 'Cotizado', 'Test drive', 'Negociación', 'Cerrado', 'Perdido',
] as const

// ── SPECS lookup (static fallback, will be overridden by DB data later) ────────

const SPECS: Record<string, { motor: string; transmision: string; consumo: string; precio: string; stock: string }> = {
  'Onix Plus 1.2 Turbo':  { motor: '1.2L Turbo – 132 CV',  transmision: 'Automática CVT', consumo: '5.8 L/100km', precio: '$28.500.000', stock: '3 unidades' },
  'Tracker Premier':       { motor: '1.2L Turbo – 132 CV',  transmision: 'Automática CVT', consumo: '6.2 L/100km', precio: '$42.000.000', stock: '2 unidades' },
  'Tracker LT':            { motor: '1.2L Turbo – 132 CV',  transmision: 'Automática CVT', consumo: '6.2 L/100km', precio: '$36.500.000', stock: '4 unidades' },
  'S10 High Country':      { motor: '2.8L Turbo Diesel – 200 CV', transmision: 'Automática 6AT', consumo: '9.1 L/100km', precio: '$78.000.000', stock: '1 unidad' },
  'S10 Midnight':          { motor: '2.8L Turbo Diesel – 200 CV', transmision: 'Automática 6AT', consumo: '9.1 L/100km', precio: '$82.000.000', stock: '1 unidad' },
  'Onix LT':               { motor: '1.0L Aspirado – 76 CV', transmision: 'Manual 5V',       consumo: '5.4 L/100km', precio: '$24.000.000', stock: '6 unidades' },
  'Onix Plus Premier':     { motor: '1.2L Turbo – 132 CV',  transmision: 'Automática CVT', consumo: '5.8 L/100km', precio: '$31.000.000', stock: '2 unidades' },
  'Cruze 5 Premier':       { motor: '1.4L Turbo – 153 CV',  transmision: 'Automática 6AT', consumo: '7.0 L/100km', precio: '$38.000.000', stock: '2 unidades' },
  'Spin LTZ 7as':          { motor: '1.8L Aspirado – 103 CV', transmision: 'Manual 5V',    consumo: '7.8 L/100km', precio: '$35.000.000', stock: '3 unidades' },
  'Spin Activ':            { motor: '1.8L Aspirado – 103 CV', transmision: 'Automática 6AT', consumo: '8.0 L/100km', precio: '$33.500.000', stock: '2 unidades' },
}

function getSpecs(modelo: string | null) {
  if (!modelo) return null
  return SPECS[modelo] ?? null
}

// ── Main component ────────────────────────────────────────────────

interface LeadDetailSheetProps {
  leadId: string | null
  onClose: () => void
  /** Called after status changes so parent can update list optimistically */
  onStatusChange?: (leadId: string, status: string) => void
}

export function LeadDetailSheet({ leadId, onClose, onStatusChange }: LeadDetailSheetProps) {
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [isPending, startTransition] = useTransition()

  // Fetch when leadId changes
  useEffect(() => {
    if (!leadId) { setDetail(null); return }
    setLoading(true)
    getLeadDetail(leadId)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [leadId])

  const lead = detail?.lead
  const notes = detail?.notes ?? []
  const timeline = detail?.timeline ?? []
  const tasks = detail?.tasks ?? []

  // ── Mutations ──────────────────────────────────────────────────

  function handleStatusChange(newStatus: string) {
    if (!lead) return
    startTransition(async () => {
      const res = await changeStatus(lead.id, newStatus as Lead['status'])
      if (res.success) {
        setDetail((d) => d ? { ...d, lead: { ...d.lead, status: newStatus as Lead['status'] } } : d)
        onStatusChange?.(lead.id, newStatus)
        toast.success(`Estado actualizado: ${newStatus}`)
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
        // Re-fetch to get new note with author info
        getLeadDetail(lead.id).then(setDetail)
        toast.success('Nota guardada')
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
            <SheetHeader className="p-6 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <SheetTitle className="text-xl">{lead.nombre}</SheetTitle>
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
                </div>

                <div className="flex shrink-0 gap-2">
                  {lead.telefono && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      asChild
                    >
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

            <div className="grid grid-cols-3 gap-6 p-6">
              {/* Left col — 2/3 width */}
              <div className="col-span-2 space-y-6">

                {/* Tasks */}
                <Section icon={<Calendar className="size-4" />} title="Próximas acciones">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin tareas pendientes.</p>
                  ) : (
                    <div className="space-y-2">
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
                                {new Date(t.due_at).toLocaleDateString('es-AR', {
                                  day: '2-digit', month: '2-digit',
                                })}
                              </div>
                            )}
                          </div>
                          {!t.done && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => handleToggleTask(t.id, true)}
                              disabled={isPending}
                            >
                              Marcar como hecho
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Vehicle specs */}
                {lead.modelo && getSpecs(lead.modelo) && (
                  <Section icon={<Car className="size-4" />} title="Vehículo de interés">
                    <div className="rounded-lg border border-border p-4 grid grid-cols-2 gap-3 text-sm">
                      <Spec label="Modelo" value={lead.modelo} />
                      <Spec label="Motor" value={getSpecs(lead.modelo)!.motor} />
                      <Spec label="Transmisión" value={getSpecs(lead.modelo)!.transmision} />
                      <Spec label="Consumo" value={getSpecs(lead.modelo)!.consumo} />
                      <Spec label="Precio sugerido" value={getSpecs(lead.modelo)!.precio} />
                      <Spec label="Stock" value={getSpecs(lead.modelo)!.stock} />
                    </div>
                  </Section>
                )}

                {/* Notes */}
                <Section icon={<FileText className="size-4" />} title="Notas internas">
                  <div className="space-y-2 mb-3">
                    {notes.map((n) => (
                      <div key={n.id} className="rounded-lg border border-border p-3 bg-muted/30">
                        <div className="text-xs text-muted-foreground mb-1">
                          {n.autor ?? 'Usuario'} ·{' '}
                          {new Date(n.created_at).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit',
                          })}
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
                      size="sm"
                      className="shrink-0 self-end gap-1.5"
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
                          {new Date(e.created_at).toLocaleDateString('es-AR', {
                            day: '2-digit', month: '2-digit',
                          })}{' '}
                          {new Date(e.created_at).toLocaleTimeString('es-AR', {
                            hour: '2-digit', minute: '2-digit',
                          })}
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

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
