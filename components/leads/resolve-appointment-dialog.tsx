'use client'

import { useState, useEffect, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn, baInputToISO, baInputFromNow } from '@/lib/utils'
import {
  Trophy, TrendingUp, CalendarPlus, UserX, ThumbsDown,
  Video, Building2, Handshake, Phone, Loader2, X,
} from 'lucide-react'
import { resolveAppointment } from '@/app/actions/appointments'
import { type AppointmentTipo } from '@/lib/schemas/appointments'

// ── Outcomes ──────────────────────────────────────────────────────
// Espeja el patrón de RegisterCallDialog: tiles de colores, cada uno define
// el resultado de la cita y el próximo paso del lead.

type ApptOutcome = 'venta' | 'avanzo' | 'otra_reunion' | 'no_show' | 'no_prospero'

const OUTCOMES: {
  value:         ApptOutcome
  label:         string
  desc:          string
  icon:          ReactNode
  selectedClass: string
}[] = [
  {
    value:         'venta',
    label:         'Venta cerrada',
    desc:          'Se concretó el trato',
    icon:          <Trophy className="size-5" />,
    selectedClass: 'border-emerald-400 text-emerald-700 bg-emerald-50/60 ring-emerald-400',
  },
  {
    value:         'avanzo',
    label:         'Avanzó',
    desc:          'Negocia el cierre',
    icon:          <TrendingUp className="size-5" />,
    selectedClass: 'border-sky-400 text-sky-700 bg-sky-50/60 ring-sky-400',
  },
  {
    value:         'otra_reunion',
    label:         'Otra reunión',
    desc:          'Hay que volver a verse',
    icon:          <CalendarPlus className="size-5" />,
    selectedClass: 'border-violet-400 text-violet-700 bg-violet-50/60 ring-violet-400',
  },
  {
    value:         'no_show',
    label:         'No se presentó',
    desc:          'No vino a la cita',
    icon:          <UserX className="size-5" />,
    selectedClass: 'border-amber-400 text-amber-700 bg-amber-50/60 ring-amber-400',
  },
  {
    value:         'no_prospero',
    label:         'No prosperó',
    desc:          'Dar de baja',
    icon:          <ThumbsDown className="size-5" />,
    selectedClass: 'border-rose-400 text-rose-700 bg-rose-50/60 ring-rose-400',
  },
]

const TIPO_TILES: {
  value: AppointmentTipo; label: string; icon: ReactNode; selectedClass: string
}[] = [
  { value: 'videollamada',    label: 'Videollamada', icon: <Video className="size-4" />,     selectedClass: 'border-sky-400 text-sky-700 bg-sky-50/60 ring-sky-400' },
  { value: 'visita_showroom', label: 'Showroom',     icon: <Building2 className="size-4" />, selectedClass: 'border-violet-400 text-violet-700 bg-violet-50/60 ring-violet-400' },
  { value: 'cierre',          label: 'Cierre',       icon: <Handshake className="size-4" />, selectedClass: 'border-emerald-400 text-emerald-700 bg-emerald-50/60 ring-emerald-400' },
]

const DURATIONS = [30, 60, 90, 120] as const

// datetime-local default "ahora + N días" a una hora fija, en horario BA.
const defaultLocal = baInputFromNow

// ── Props ─────────────────────────────────────────────────────────

interface ResolveAppointmentDialogProps {
  open:          boolean
  onOpenChange:  (v: boolean) => void
  appointmentId: string
  tipoActual:    AppointmentTipo
  /** Se llama tras resolver. Si openVenta/openBaja, el padre abre ese diálogo. */
  onResolved:    (r: { openVenta: boolean; openBaja: boolean }) => void
}

// ── Component ─────────────────────────────────────────────────────

export function ResolveAppointmentDialog({
  open, onOpenChange, appointmentId, tipoActual, onResolved,
}: ResolveAppointmentDialogProps) {
  const [outcome,  setOutcome]  = useState<ApptOutcome | null>(null)
  const [notes,    setNotes]    = useState('')
  const [isPending, startTransition] = useTransition()

  // Próxima acción (avanzo / otra_reunion)
  const [nextKind,  setNextKind]  = useState<'cita' | 'llamada'>('cita')
  const [nextAt,    setNextAt]    = useState('')
  const [nextTipo,  setNextTipo]  = useState<AppointmentTipo>('cierre')
  const [nextDur,   setNextDur]   = useState<number>(60)
  const [nextLugar, setNextLugar] = useState('')
  // Reintento (no_show)
  const [retryAt,   setRetryAt]   = useState('')

  function reset() {
    setOutcome(null); setNotes('')
    setNextKind('cita'); setNextAt(''); setNextTipo('cierre'); setNextDur(60); setNextLugar('')
    setRetryAt('')
  }

  // Defaults al elegir cada outcome
  function handleSelect(v: ApptOutcome) {
    setOutcome(v)
    if (v === 'avanzo') {
      setNextKind('cita')
      if (!nextAt) setNextAt(defaultLocal(2, 11))
      setNextTipo('cierre')   // avanzó → próxima suele ser cierre
    }
    if (v === 'otra_reunion') {
      setNextKind('cita')
      if (!nextAt) setNextAt(defaultLocal(2, 11))
      setNextTipo(tipoActual) // misma índole que la cita actual
    }
    if (v === 'no_show' && !retryAt) {
      setRetryAt(defaultLocal(1, 10))
    }
  }

  const needsLugar = nextTipo === 'visita_showroom'

  const submitDisabled =
    !outcome ||
    isPending ||
    ((outcome === 'avanzo' || outcome === 'otra_reunion') && (
      !nextAt ||
      (nextKind === 'cita' && needsLugar && !nextLugar.trim())
    ))

  function handleSubmit() {
    if (!outcome) { toast.error('Elegí cómo resultó la cita'); return }

    // Para otra_reunion, la próxima acción es siempre una cita.
    const kind = outcome === 'otra_reunion' ? 'cita' : nextKind

    const nextAction =
      (outcome === 'avanzo' || outcome === 'otra_reunion')
        ? {
            kind,
            scheduled_at: baInputToISO(nextAt),
            ...(kind === 'cita'
              ? { tipo: nextTipo, duration_min: nextDur, lugar: nextLugar.trim() || undefined }
              : {}),
          }
        : undefined

    startTransition(async () => {
      const res = await resolveAppointment(appointmentId, {
        outcome,
        notes:       notes.trim() || undefined,
        nextAction,
        retryCallAt: outcome === 'no_show' && retryAt ? baInputToISO(retryAt) : undefined,
      })
      if (!res.success) { toast.error(res.error); return }

      const labels: Record<ApptOutcome, string> = {
        venta:        'Cita cerrada — registrá la venta',
        avanzo:       'Resultado guardado — próxima acción agendada',
        otra_reunion: 'Resultado guardado — nueva cita agendada',
        no_show:      retryAt ? 'No-show — reintento agendado' : 'No-show registrado',
        no_prospero:  'Resultado guardado',
      }
      toast.success(labels[outcome])
      onResolved({ openVenta: res.data.openVenta, openBaja: res.data.openBaja })
      reset()
      onOpenChange(false)
    })
  }

  // Reset al cerrar
  useEffect(() => { if (!open) reset() }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>¿Cómo resultó la cita?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Outcome tiles */}
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handleSelect(o.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-center transition-all',
                  outcome === o.value
                    ? `${o.selectedClass} ring-2 ring-offset-1 ring-current`
                    : 'border-border hover:border-muted-foreground/40',
                  // 'no_prospero' (5º) ocupa toda la fila para quedar separado como salida
                  o.value === 'no_prospero' && 'col-span-2',
                )}
              >
                <span className={outcome === o.value ? '' : 'text-muted-foreground'}>{o.icon}</span>
                <span className={cn('text-xs font-semibold leading-tight', outcome !== o.value && 'text-foreground')}>
                  {o.label}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">{o.desc}</span>
              </button>
            ))}
          </div>

          {/* Venta — confirma y pasa a registrar venta */}
          {outcome === 'venta' && (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 leading-snug">
              La entrevista se concretó en venta. Al confirmar, el lead pasa a <b>Cierre</b> y se
              abre el registro de la venta.
            </p>
          )}

          {/* No prosperó — confirma y abre baja */}
          {outcome === 'no_prospero' && (
            <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 leading-snug">
              La entrevista se hizo pero no avanzó. Al confirmar se abre <b>Dar de baja</b> para
              registrar el motivo (se puede rescatar después según el motivo).
            </p>
          )}

          {/* Avanzó — próxima acción obligatoria (cita o llamada) */}
          {outcome === 'avanzo' && (
            <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                <TrendingUp className="size-3.5" />
                Próxima acción <span className="font-normal text-sky-700/70">(obligatoria)</span>
              </div>
              {/* Toggle cita / llamada */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNextKind('cita')}
                  className={cn('flex items-center justify-center gap-1.5 rounded-md border-2 px-2 py-1.5 text-xs font-medium transition-all',
                    nextKind === 'cita' ? 'border-violet-400 text-violet-700 bg-violet-50' : 'border-border text-muted-foreground hover:border-muted-foreground/40')}
                >
                  <CalendarPlus className="size-3.5" />Cita de cierre
                </button>
                <button
                  type="button"
                  onClick={() => setNextKind('llamada')}
                  className={cn('flex items-center justify-center gap-1.5 rounded-md border-2 px-2 py-1.5 text-xs font-medium transition-all',
                    nextKind === 'llamada' ? 'border-sky-400 text-sky-700 bg-sky-50' : 'border-border text-muted-foreground hover:border-muted-foreground/40')}
                >
                  <Phone className="size-3.5" />Llamada
                </button>
              </div>
              <NextActionFields
                kind={nextKind}
                at={nextAt} setAt={setNextAt}
                tipo={nextTipo} setTipo={setNextTipo}
                dur={nextDur} setDur={setNextDur}
                lugar={nextLugar} setLugar={setNextLugar}
              />
            </div>
          )}

          {/* Otra reunión — nueva cita obligatoria */}
          {outcome === 'otra_reunion' && (
            <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                <CalendarPlus className="size-3.5" />
                Nueva cita <span className="font-normal text-violet-700/70">(obligatoria)</span>
              </div>
              <NextActionFields
                kind="cita"
                at={nextAt} setAt={setNextAt}
                tipo={nextTipo} setTipo={setNextTipo}
                dur={nextDur} setDur={setNextDur}
                lugar={nextLugar} setLugar={setNextLugar}
              />
            </div>
          )}

          {/* No-show — reintento opcional */}
          {outcome === 'no_show' && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <UserX className="size-3.5" />
                No se presentó
              </div>
              <p className="text-[11px] text-amber-700/80 leading-snug">
                El lead vuelve a seguimiento. No cuenta como contacto efectivo. Te sugerimos
                <b> agendar un reintento</b> para recontactarlo.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Reintentar contacto</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={retryAt}
                    onChange={(e) => setRetryAt(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                <p className="text-[10px] text-amber-700/60">Opcional — podés quitarlo.</p>
              </div>
            </div>
          )}

          {/* Notas (todos) */}
          {outcome && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Notas de la cita <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                placeholder="Ej: Mostró mucho interés, falta confirmar financiación..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitDisabled} className="gap-1.5">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Confirmar resultado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Sub: campos de próxima acción ──────────────────────────────────

function NextActionFields({
  kind, at, setAt, tipo, setTipo, dur, setDur, lugar, setLugar,
}: {
  kind:    'cita' | 'llamada'
  at:      string;  setAt:    (v: string) => void
  tipo:    AppointmentTipo; setTipo: (v: AppointmentTipo) => void
  dur:     number;  setDur:   (v: number) => void
  lugar:   string;  setLugar: (v: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Fecha y hora *</Label>
        <input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {kind === 'cita' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de cita *</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPO_TILES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border-2 px-1.5 py-2 text-center transition-all',
                    tipo === t.value
                      ? `${t.selectedClass} ring-2 ring-offset-1 ring-current`
                      : 'border-border hover:border-muted-foreground/40',
                  )}
                >
                  <span className={tipo === t.value ? '' : 'text-muted-foreground'}>{t.icon}</span>
                  <span className={cn('text-[11px] font-semibold leading-tight', tipo !== t.value && 'text-foreground')}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Duración</Label>
            <Select value={String(dur)} onValueChange={(v) => setDur(Number(v))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d < 60 ? `${d} min` : `${d / 60} h`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipo === 'visita_showroom' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Lugar *</Label>
              <Input
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="Ej: Showroom Av. Cabildo"
                className="h-9 text-sm"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
