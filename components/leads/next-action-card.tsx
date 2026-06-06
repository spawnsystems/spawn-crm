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
  Trophy, ThumbsDown, UserX,
} from 'lucide-react'
import { markContacted, reactivateFromRescue } from '@/app/actions/leads'
import { markAppointmentDone, markAppointmentNoShow, cancelAppointment } from '@/app/actions/appointments'
import type { getNextAppointmentForLead } from '@/app/actions/appointments'
import { APPOINTMENT_TIPO_LABEL } from '@/lib/schemas/appointments'
import { isBaja, isRescatable, statusLabel } from '@/lib/leads/constants'
import { BajaDialog } from '@/components/leads/baja-dialog'
import { RegistrarVentaDialog } from '@/components/leads/registrar-venta-dialog'
import { useCurrentUser } from '@/lib/tenant/context'

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
  const currentUser = useCurrentUser()
  const canReactivate = currentUser.rol !== 'vendedor'

  const [showDialog,          setShowDialog]          = useState(false)
  const [showBajaNoInteresado, setShowBajaNoInteresado] = useState(false)
  const [showVenta,           setShowVenta]           = useState(false)
  const [isPending,            startTransition]        = useTransition()

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

  // ── VENTA ─────────────────────────────────────────────────────
  if (lead.status === 'VENTA') {
    return (
      <div className="mx-6 mb-4 flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200/60 px-4 py-3">
        <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-emerald-800">Venta concretada</div>
          <div className="text-xs text-emerald-700/60 mt-0.5">
            Lead cerrado exitosamente. No hay acciones pendientes.
          </div>
        </div>
      </div>
    )
  }

  // ── Baja (terminal negativo) ──────────────────────────────────
  if (isBaja(lead.status)) {
    const rescatable = isRescatable(lead.status)
    return (
      <div className="mx-6 mb-4 rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <LifeBuoy className="size-4 text-amber-600 shrink-0" />
          <span className="text-sm font-semibold text-amber-800">
            Dado de baja — {statusLabel(lead.status)}
          </span>
        </div>
        <p className="text-xs text-amber-700/60 mb-3">
          {rescatable && canReactivate
            ? 'Retomá el contacto para reactivar este lead al flujo principal (volverá a Gestión).'
            : rescatable && !canReactivate
            ? 'Este lead está en rescate. Un supervisor puede reactivarlo desde la sección Rescate.'
            : 'Este lead no se reactiva. Si fue un error, un supervisor puede gestionarlo desde Rescate.'}
        </p>
        {rescatable && canReactivate && (
          <Button
            size="sm"
            className={cn('gap-1.5', isPending && 'opacity-70')}
            onClick={() => run(
              () => reactivateFromRescue(lead.id),
              'Lead reactivado — ahora en Gestión',
            )}
            disabled={isPending}
          >
            {isPending
              ? <Loader2 className="size-3.5 animate-spin" />
              : <RotateCcw className="size-3.5" />}
            Reactivar contacto
          </Button>
        )}
      </div>
    )
  }

  // ── ENTREVISTA PACTADA — con cita programada ──────────────────
  if (lead.status === 'ENTREVISTA PACTADA' && nextAppointment) {
    const apptDate = toBADate(nextAppointment.scheduled_at)
    const isPast   = new Date(nextAppointment.scheduled_at).getTime() < Date.now()
    const dur      = nextAppointment.duration_min

    return (
      <>
        <div className="mx-6 mb-4 rounded-xl bg-violet-50 border border-violet-200/60 px-4 py-3">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <CalendarCheck className="size-4 text-violet-600 shrink-0" />
            <span className="text-sm font-semibold text-violet-900">Cita programada</span>
            {isPast && (
              <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200/60 rounded-full px-2 py-0.5 font-medium">
                Ya pasó — ¿cómo resultó?
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

          {/* ── Panel de resolución (cita ya pasada) ── */}
          {isPast ? (
            <div className="space-y-3">
              {/* Éxito */}
              <div>
                <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">
                  Éxito
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => run(
                      () => markAppointmentDone(nextAppointment.id),
                      'Cita realizada — en proceso de cierre',
                    )}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    Cita realizada → Cierre
                  </Button>
                </div>
                <p className="text-[10px] text-emerald-700/60 mt-1.5">
                  La venta se registra desde el lead una vez en Cierre.
                </p>
              </div>

              {/* Fallo */}
              <div>
                <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wide mb-1.5">
                  No fue
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50"
                    onClick={() => run(
                      () => markAppointmentNoShow(nextAppointment.id),
                      'No-show registrado',
                    )}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <UserX className="size-3.5" />}
                    No vino
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50"
                    onClick={() => setShowBajaNoInteresado(true)}
                    disabled={isPending}
                  >
                    <ThumbsDown className="size-3.5" />
                    No interesado
                  </Button>
                </div>
              </div>

              {/* Reagendar / cancelar siempre disponibles */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-violet-200/60">
                <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => setShowDialog(true)}>
                  <Plus className="size-3.5" />Reagendar
                </Button>
                <Button
                  size="sm" variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => run(() => cancelAppointment(nextAppointment.id), 'Cita cancelada')}
                  disabled={isPending}
                >
                  Cancelar cita
                </Button>
              </div>
            </div>
          ) : (
            /* Cita futura — acciones simples */
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => run(() => markAppointmentDone(nextAppointment.id), 'Cita marcada como realizada')}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                Marcar realizada
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDialog(true)}>
                <Plus className="size-3.5" />Reagendar
              </Button>
              <Button
                size="sm" variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => run(() => cancelAppointment(nextAppointment.id), 'Cita cancelada')}
                disabled={isPending}
              >
                Cancelar cita
              </Button>
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

        {/* Dialog baja "No interesado" prefijado */}
        <BajaDialog
          open={showBajaNoInteresado}
          onOpenChange={setShowBajaNoInteresado}
          leadId={lead.id}
          leadNombre={lead.nombre}
          prefilledStatus="NO INTERESADO"
          onDone={() => { setShowBajaNoInteresado(false); onLeadUpdated() }}
        />
      </>
    )
  }

  // ── CIERRE — en negociación, listo para registrar la venta ────
  if (lead.status === 'CIERRE') {
    return (
      <>
        <div className="mx-6 mb-4 rounded-xl bg-emerald-50 border border-emerald-200/60 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Trophy className="size-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold text-emerald-900">En proceso de cierre</span>
          </div>
          <p className="text-xs text-emerald-700/70 mb-3">
            La entrevista se concretó. Cuando se cierre el trato, registrá la venta para
            finalizar el lead.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowVenta(true)}
              disabled={isPending}
            >
              <Trophy className="size-3.5" />
              Registrar venta
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowDialog(true)}>
              <Plus className="size-3.5" />
              Organizar otra cita
            </Button>
          </div>
        </div>

        <RegistrarVentaDialog
          open={showVenta}
          onOpenChange={setShowVenta}
          leadId={lead.id}
          leadNombre={lead.nombre}
          defaultModelo={lead.modelo}
          onDone={onLeadUpdated}
        />

        <AppointmentDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          leadId={lead.id}
          leadNombre={lead.nombre}
          defaultModelo={lead.modelo}
          onCreated={() => { setShowDialog(false); onLeadUpdated() }}
        />
      </>
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
  // "sin cita activa" cuando ya estaba en ENTREVISTA PACTADA pero la cita se completó
  const isCitado = lead.status === 'ENTREVISTA PACTADA'

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
          ? 'La cita anterior fue completada. Organizá una nueva cita para avanzar.'
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
