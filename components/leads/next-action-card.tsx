'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn, toBADate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AppointmentDialog } from '@/components/leads/appointment-dialog'
import {
  Phone, CalendarCheck, CheckCircle2, LifeBuoy, Plus, RotateCcw, Loader2, Send,
} from 'lucide-react'
import { markContacted, markAsClosed, reactivateFromRescue } from '@/app/actions/leads'
import { markAppointmentDone, cancelAppointment } from '@/app/actions/appointments'
import type { getNextAppointmentForLead } from '@/app/actions/appointments'
import { APPOINTMENT_TIPO_LABEL } from '@/lib/schemas/appointments'

// ── Types ─────────────────────────────────────────────────────────

type Appointment = Awaited<ReturnType<typeof getNextAppointmentForLead>> | null

interface NextActionCardProps {
  lead: {
    id:      string
    status:  string
    nombre:  string
    modelo?: string | null
  }
  nextAppointment: Appointment
  onLeadUpdated:   () => void
}

// ── Component ─────────────────────────────────────────────────────

export function NextActionCard({ lead, nextAppointment, onLeadUpdated }: NextActionCardProps) {
  const [showDialog,  setShowDialog]  = useState(false)
  const [isPending,   startTransition] = useTransition()

  /** Fire an action, show a toast, then refresh the parent */
  function run(
    fn:          () => Promise<{ success: boolean; error?: string; data?: unknown }>,
    successMsg?: string,
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.success) { toast.error(res.error); return }
      if (successMsg) toast.success(successMsg)
      onLeadUpdated()
    })
  }

  // ── Cerrado ───────────────────────────────────────────────────
  if (lead.status === 'Cerrado') {
    return (
      <div className="mx-6 mb-4 flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200/60 px-4 py-3">
        <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-emerald-800">Venta cerrada</div>
          <div className="text-xs text-emerald-700/60 mt-0.5">
            Lead cerrado exitosamente. No hay acciones pendientes.
          </div>
        </div>
      </div>
    )
  }

  // ── Para rescate ──────────────────────────────────────────────
  if (lead.status === 'Para rescate') {
    return (
      <div className="mx-6 mb-4 rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <LifeBuoy className="size-4 text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-800">Lead inactivo — en rescate</span>
        </div>
        <p className="text-xs text-amber-700/60 mb-3">
          Retomá el contacto para reactivar este lead al flujo principal (volverá a estado Contactado).
        </p>
        <Button
          size="sm"
          className={cn('gap-1.5', isPending && 'opacity-70')}
          onClick={() => run(
            () => reactivateFromRescue(lead.id),
            'Lead reactivado — ahora en Contactado',
          )}
          disabled={isPending}
        >
          {isPending
            ? <Loader2 className="size-3.5 animate-spin" />
            : <RotateCcw className="size-3.5" />}
          Reactivar contacto
        </Button>
      </div>
    )
  }

  // ── Nuevo ─────────────────────────────────────────────────────
  if (lead.status === 'Nuevo') {
    return (
      <div className="mx-6 mb-4 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Phone className="size-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Primer contacto pendiente</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Este lead aún no fue contactado. Registrá el primer contacto para avanzar en el flujo.
        </p>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            startTransition(async () => {
              const res = await markContacted(lead.id)
              if (!res.success) { toast.error(res.error); return }
              toast.success(
                res.data?.advanced
                  ? 'Contacto registrado — lead avanzado a Contactado'
                  : 'Contacto registrado',
              )
              onLeadUpdated()
            })
          }}
          disabled={isPending}
        >
          {isPending
            ? <Loader2 className="size-3.5 animate-spin" />
            : <Phone className="size-3.5" />}
          Registrar primer contacto
        </Button>
      </div>
    )
  }

  // ── Citado — con cita programada ──────────────────────────────
  if (lead.status === 'Citado' && nextAppointment) {
    const apptDate = toBADate(nextAppointment.scheduled_at)
    const isPast   = new Date(nextAppointment.scheduled_at).getTime() < Date.now()
    const dur      = nextAppointment.duration_min

    return (
      <div className="mx-6 mb-4 rounded-xl bg-violet-50 border border-violet-200/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarCheck className="size-4 text-violet-600 shrink-0" />
          <span className="text-sm font-semibold text-violet-900">Cita programada</span>
          {isPast && (
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200/60 rounded-full px-2 py-0.5 font-medium">
              Fecha pasada
            </span>
          )}
        </div>

        {/* Appointment details */}
        <div className="mb-3 space-y-0.5">
          <div className="text-sm font-medium text-violet-900">
            {format(apptDate, "EEEE d 'de' MMMM 'a las' HH:mm 'hs'", { locale: es })}
          </div>
          <div className="text-xs text-violet-700/70">
            {APPOINTMENT_TIPO_LABEL[nextAppointment.tipo]}
            {nextAppointment.lugar && ` · ${nextAppointment.lugar}`}
            {' · '}{dur < 60 ? `${dur} min` : `${dur / 60} h`}
          </div>
          {nextAppointment.notas && (
            <div className="text-xs text-violet-600/60 italic mt-1">
              {nextAppointment.notas}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => run(
              () => markAppointmentDone(nextAppointment.id),
              'Cita marcada como realizada',
            )}
            disabled={isPending}
          >
            {isPending
              ? <Loader2 className="size-3.5 animate-spin" />
              : <CheckCircle2 className="size-3.5" />}
            Marcar realizada
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowDialog(true)}
          >
            <Plus className="size-3.5" />
            Reagendar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => run(
              () => cancelAppointment(nextAppointment.id),
              'Cita cancelada',
            )}
            disabled={isPending}
          >
            Cancelar cita
          </Button>
        </div>

        <AppointmentDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          leadId={lead.id}
          leadNombre={lead.nombre}
          defaultModelo={lead.modelo}
          onCreated={() => { setShowDialog(false); onLeadUpdated() }}
        />
      </div>
    )
  }

  // ── Contactado o Citado sin cita viva ─────────────────────────
  return (
    <ContactadoCard
      lead={lead}
      isPending={isPending}
      showDialog={showDialog}
      setShowDialog={setShowDialog}
      onLeadUpdated={onLeadUpdated}
      run={run}
    />
  )
}

// ── Sub-componente para el estado Contactado ──────────────────────
// Separado para poder tener su propio estado de UI (llamada inline)
// sin contaminar el hook isPending/startTransition del padre.

function ContactadoCard({
  lead,
  isPending,
  showDialog,
  setShowDialog,
  onLeadUpdated,
  run,
}: {
  lead: NextActionCardProps['lead']
  isPending: boolean
  showDialog: boolean
  setShowDialog: (v: boolean) => void
  onLeadUpdated: () => void
  run: (fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>, msg?: string) => void
}) {
  const [showCallForm, setShowCallForm] = useState(false)
  const [callNote,     setCallNote]     = useState('')
  const isCitado = lead.status === 'Citado'

  function handleRegisterCall() {
    run(
      () => markContacted(lead.id, callNote.trim() || undefined),
      'Llamada registrada',
    )
    setCallNote('')
    setShowCallForm(false)
  }

  return (
    <div className="mx-6 mb-4 rounded-xl bg-blue-50 border border-blue-200/60 px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <CalendarCheck className="size-4 text-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-blue-900">
          {isCitado ? 'Sin cita activa' : 'En seguimiento'}
        </span>
      </div>
      <p className="text-xs text-blue-700/60 mb-3">
        {isCitado
          ? 'La cita anterior fue completada. Organizá una nueva cita o cerrá la venta.'
          : 'Registrá cada llamada o contacto, y organizá una cita cuando el cliente esté listo.'}
      </p>

      {/* Acciones principales */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => setShowDialog(true)}>
          <Plus className="size-3.5" />
          Organizar cita
        </Button>

        {/* Registrar llamada — solo para Contactado, no para Citado sin cita */}
        {!isCitado && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowCallForm((v) => !v)}
          >
            <Phone className="size-3.5" />
            Registrar llamada
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => run(() => markAsClosed(lead.id), 'Lead cerrado — venta confirmada')}
          disabled={isPending}
        >
          {isPending
            ? <Loader2 className="size-3.5 animate-spin" />
            : <CheckCircle2 className="size-3.5" />}
          Marcar como cerrado
        </Button>
      </div>

      {/* Mini-form inline para la nota de la llamada */}
      {showCallForm && (
        <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-2">
          <p className="text-[11px] text-blue-700/60">
            Opcional: dejá una nota sobre la llamada (resultado, qué dijo el cliente, etc.)
          </p>
          <Textarea
            placeholder="Ej: llamé, interesado pero viaja esta semana. Vuelvo a llamar el lunes."
            className="text-sm min-h-[60px] resize-none bg-white border-blue-200"
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleRegisterCall() }}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleRegisterCall}
              disabled={isPending}
            >
              {isPending
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Send className="size-3.5" />}
              Guardar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => { setShowCallForm(false); setCallNote('') }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <AppointmentDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        leadId={lead.id}
        leadNombre={lead.nombre}
        defaultModelo={lead.modelo}
        onCreated={() => { setShowDialog(false); onLeadUpdated() }}
      />
    </div>
  )
}
