'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn, toBADate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AppointmentDialog } from '@/components/leads/appointment-dialog'
import {
  Phone, CalendarCheck, CheckCircle2, LifeBuoy, Plus, RotateCcw, Loader2,
  Trophy, ClipboardCheck,
} from 'lucide-react'
import { reactivateFromRescue } from '@/app/actions/leads'
import { cancelAppointment } from '@/app/actions/appointments'
import type { getNextAppointmentForLead } from '@/app/actions/appointments'
import { APPOINTMENT_TIPO_LABEL } from '@/lib/schemas/appointments'
import { isBaja, isRescatable, statusLabel } from '@/lib/leads/constants'
import { BajaDialog } from '@/components/leads/baja-dialog'
import { RegistrarVentaDialog } from '@/components/leads/registrar-venta-dialog'
import { ResolveAppointmentDialog } from '@/components/leads/resolve-appointment-dialog'
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
  /** Abre el flujo unificado de registrar llamada (ad-hoc) para este lead. */
  onRegisterCall:  () => void
}

// ── Component ─────────────────────────────────────────────────────

export function NextActionCard({ lead, nextAppointment, onLeadUpdated, onRegisterCall }: NextActionCardProps) {
  const currentUser = useCurrentUser()
  const canReactivate = currentUser.rol !== 'vendedor'

  const [showDialog,   setShowDialog]   = useState(false)
  const [showBaja,     setShowBaja]     = useState(false)
  const [showVenta,    setShowVenta]    = useState(false)
  const [showResolve,  setShowResolve]  = useState(false)
  const [isPending,    startTransition] = useTransition()

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
      <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200/60 px-4 py-3">
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
      <div className="rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3">
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

  // ── Con cita programada (ENTREVISTA PACTADA o CIERRE) ─────────
  // Mientras haya una cita viva (incluso una cita de cierre agendada estando
  // ya en CIERRE), la acción principal es registrar su resultado.
  if (nextAppointment && (lead.status === 'ENTREVISTA PACTADA' || lead.status === 'CIERRE')) {
    const apptDate = toBADate(nextAppointment.scheduled_at)
    const isPast   = new Date(nextAppointment.scheduled_at).getTime() < Date.now()
    const dur      = nextAppointment.duration_min

    return (
      <>
        <div className="rounded-xl bg-violet-50 border border-violet-200/60 px-4 py-3">
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

          {/* ── Acciones ── */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className={cn('gap-1.5', isPast && 'bg-violet-600 hover:bg-violet-700')}
              onClick={() => setShowResolve(true)}
              disabled={isPending}
            >
              <ClipboardCheck className="size-3.5" />
              Registrar resultado
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
          {!isPast && (
            <p className="text-[10px] text-violet-700/60 mt-1.5">
              Cuando la cita ocurra, registrá cómo resultó para definir el próximo paso.
            </p>
          )}
        </div>

        {/* Flujo unificado de resultado de cita */}
        <ResolveAppointmentDialog
          open={showResolve}
          onOpenChange={setShowResolve}
          appointmentId={nextAppointment.id}
          tipoActual={nextAppointment.tipo}
          onResolved={({ openVenta, openBaja }) => {
            onLeadUpdated()
            if (openVenta) setShowVenta(true)
            if (openBaja)  setShowBaja(true)
          }}
        />

        <RegistrarVentaDialog
          open={showVenta}
          onOpenChange={setShowVenta}
          leadId={lead.id}
          leadNombre={lead.nombre}
          defaultModelo={lead.modelo}
          onDone={onLeadUpdated}
        />

        <BajaDialog
          open={showBaja}
          onOpenChange={setShowBaja}
          leadId={lead.id}
          leadNombre={lead.nombre}
          onDone={() => { setShowBaja(false); onLeadUpdated() }}
        />
      </>
    )
  }

  // ── CIERRE — en negociación, listo para registrar la venta ────
  if (lead.status === 'CIERRE') {
    return (
      <>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200/60 px-4 py-3">
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
      showDialog={showDialog}
      setShowDialog={setShowDialog}
      onLeadUpdated={onLeadUpdated}
      onRegisterCall={onRegisterCall}
    />
  )
}

// ── Sub-componente para el estado Contactado ──────────────────────
// El registro de llamada usa el flujo unificado (con resultado) que vive
// en el lead sheet; acá solo disparamos su apertura vía onRegisterCall.

function ContactadoCard({
  lead,
  showDialog,
  setShowDialog,
  onLeadUpdated,
  onRegisterCall,
}: {
  lead: NextActionCardProps['lead']
  showDialog: boolean
  setShowDialog: (v: boolean) => void
  onLeadUpdated: () => void
  onRegisterCall: () => void
}) {
  // "sin cita activa" cuando ya estaba en ENTREVISTA PACTADA pero la cita se completó
  const isCitado = lead.status === 'ENTREVISTA PACTADA'
  const isNuevo  = lead.status === 'NUEVO'

  return (
    <div className="rounded-xl bg-blue-50 border border-blue-200/60 px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <CalendarCheck className="size-4 text-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-blue-900">
          {isCitado ? 'Sin cita activa' : isNuevo ? 'Lead nuevo — sin contactar' : 'En seguimiento'}
        </span>
      </div>
      <p className="text-xs text-blue-700/60 mb-3">
        {isCitado
          ? 'La cita anterior fue completada. Organizá una nueva cita para avanzar.'
          : isNuevo
          ? 'Hacé el primer contacto: registrá una llamada o agendá una cita para empezar a gestionarlo.'
          : 'Registrá la llamada (queda con su resultado) o agendá una cita cuando el cliente esté listo.'}
      </p>

      {/* Acciones principales */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => setShowDialog(true)}>
          <Plus className="size-3.5" />
          Organizar cita
        </Button>

        {/* Registrar llamada — flujo unificado con resultado */}
        {!isCitado && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onRegisterCall}
          >
            <Phone className="size-3.5" />
            Registrar llamada
          </Button>
        )}
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
