'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { format } from 'date-fns'
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { CalendarIcon, Loader2, Video, Building2, Handshake } from 'lucide-react'
import { createAppointment } from '@/app/actions/appointments'
import {
  DURATIONS_MIN,
  type AppointmentTipo,
} from '@/lib/schemas/appointments'

// ── Tipo tiles ────────────────────────────────────────────────────
const TIPO_TILES: {
  value:         AppointmentTipo
  label:         string
  desc:          string
  icon:          ReactNode
  selectedClass: string
}[] = [
  {
    value:         'videollamada',
    label:         'Videollamada',
    desc:          'Reunión virtual con el cliente',
    icon:          <Video className="size-5" />,
    selectedClass: 'border-sky-400 text-sky-700 bg-sky-50/60 ring-sky-400',
  },
  {
    value:         'visita_showroom',
    label:         'Visita al showroom',
    desc:          'El cliente viene a vernos',
    icon:          <Building2 className="size-5" />,
    selectedClass: 'border-violet-400 text-violet-700 bg-violet-50/60 ring-violet-400',
  },
  {
    value:         'cierre',
    label:         'Cierre',
    desc:          'Confirmar la venta',
    icon:          <Handshake className="size-5" />,
    selectedClass: 'border-emerald-400 text-emerald-700 bg-emerald-50/60 ring-emerald-400',
  },
]

// ── Types ─────────────────────────────────────────────────────────

interface AppointmentDialogProps {
  open:           boolean
  onOpenChange:   (v: boolean) => void
  leadId:         string
  leadNombre:     string
  defaultModelo?: string | null
  onCreated?:     (appointmentId: string) => void
}

// ── Component ─────────────────────────────────────────────────────

export function AppointmentDialog({
  open, onOpenChange, leadId, leadNombre, defaultModelo, onCreated,
}: AppointmentDialogProps) {
  const [date,          setDate]          = useState<Date | undefined>()
  const [time,          setTime]          = useState('10:00')
  const [durationMin,   setDurationMin]   = useState<number>(60)
  const [tipo,          setTipo]          = useState<AppointmentTipo>('visita_showroom')
  const [lugar,         setLugar]         = useState('')
  const [modeloInteres, setModeloInteres] = useState(defaultModelo ?? '')
  const [notas,         setNotas]         = useState('')
  const [calendarOpen,  setCalendarOpen]  = useState(false)
  const [isPending,     startTransition]  = useTransition()

  function reset() {
    setDate(undefined)
    setTime('10:00')
    setDurationMin(60)
    setTipo('visita_showroom')
    setLugar('')
    setModeloInteres(defaultModelo ?? '')
    setNotas('')
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  function handleSubmit() {
    if (!date) { toast.error('Elegí una fecha para la cita'); return }

    // Combine date + time into a single Date
    const [hh, mm] = time.split(':').map(Number)
    const scheduledAt = new Date(date)
    scheduledAt.setHours(hh ?? 10, mm ?? 0, 0, 0)

    if (scheduledAt.getTime() <= Date.now()) {
      toast.error('La fecha y hora deben ser en el futuro')
      return
    }

    startTransition(async () => {
      const res = await createAppointment({
        lead_id:        leadId,
        scheduled_at:   scheduledAt,
        duration_min:   durationMin,
        tipo,
        lugar:          lugar.trim()         || undefined,
        modelo_interes: modeloInteres.trim() || undefined,
        notas:          notas.trim()         || undefined,
      })

      if (!res.success) { toast.error(res.error); return }

      if (res.data?.conflict) {
        toast.warning('Cita agendada — hay un conflicto de horario con otra cita del vendedor')
      } else {
        toast.success('Cita agendada')
      }

      handleOpenChange(false)
      onCreated?.(res.data?.id ?? '')
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Organizar cita</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">{leadNombre}</p>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha *</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full h-9 text-sm justify-start font-normal',
                      !date && 'text-muted-foreground',
                    )}
                  >
                    <CalendarIcon className="size-3.5 mr-2 shrink-0" />
                    {date ? format(date, 'dd/MM/yyyy') : 'Seleccionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { setDate(d); setCalendarOpen(false) }}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Hora *</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Tipo de cita */}
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de cita *</Label>
            <div className="grid grid-cols-3 gap-2">
              {TIPO_TILES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-center transition-all',
                    tipo === t.value
                      ? `${t.selectedClass} ring-2 ring-offset-1 ring-current`
                      : 'border-border hover:border-muted-foreground/40',
                  )}
                >
                  <span className={tipo === t.value ? '' : 'text-muted-foreground'}>{t.icon}</span>
                  <span className={cn('text-xs font-semibold leading-tight', tipo !== t.value && 'text-foreground')}>
                    {t.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {t.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Duración */}
          <div className="space-y-1.5">
            <Label className="text-xs">Duración</Label>
            <Select
              value={String(durationMin)}
              onValueChange={(v) => setDurationMin(Number(v))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS_MIN.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d < 60 ? `${d} min` : `${d / 60} h`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Modelo */}
          <div className="space-y-1.5">
            <Label className="text-xs">Modelo de interés</Label>
            <Input
              placeholder="Ej: Tracker Premier"
              value={modeloInteres}
              onChange={(e) => setModeloInteres(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Lugar */}
          <div className="space-y-1.5">
            <Label className="text-xs">Lugar</Label>
            <Input
              placeholder="Ej: Showroom principal, Sucursal Norte..."
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notas</Label>
            <Textarea
              placeholder="Instrucciones, preferencias del cliente..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="text-sm resize-none min-h-[72px]"
            />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!date || isPending}>
            {isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
            Agendar cita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
