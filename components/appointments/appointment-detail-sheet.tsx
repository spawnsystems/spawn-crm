'use client'

import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import {
  Loader2, CalendarIcon, MapPin, Clock, User, ExternalLink, CheckCircle2, X,
} from 'lucide-react'
import { cn, toBADate } from '@/lib/utils'
import { markAppointmentDone, cancelAppointment } from '@/app/actions/appointments'
import {
  APPOINTMENT_TIPO_LABEL,
  APPOINTMENT_STATUS_LABEL,
} from '@/lib/schemas/appointments'
import type { getAppointmentsInRange } from '@/app/actions/appointments'

type ApptRow = Awaited<ReturnType<typeof getAppointmentsInRange>>[number]

// ── Props ─────────────────────────────────────────────────────────

interface AppointmentDetailSheetProps {
  appointment: ApptRow | null
  onClose:     () => void
  onUpdated:   () => void
}

// ── Component ─────────────────────────────────────────────────────

export function AppointmentDetailSheet({
  appointment: appt,
  onClose,
  onUpdated,
}: AppointmentDetailSheetProps) {
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  function run(
    fn:         () => Promise<{ success: boolean; error?: string }>,
    successMsg: string,
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.success) { toast.error(res.error); return }
      toast.success(successMsg)
      onUpdated()
      onClose()
    })
  }

  return (
    <>
      <Sheet open={!!appt} onOpenChange={(o) => !o && onClose()}>
        {/* [&>button]:hidden oculta el X de cierre por defecto de shadcn */}
        <SheetContent className="w-full sm:max-w-lg p-0 overflow-y-auto [&>button]:hidden">
          {appt && (
            <>
              {/* ── Header ── */}
              <SheetHeader className="p-6 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="text-lg leading-tight">
                      {appt.lead_nombre ?? 'Lead'}
                    </SheetTitle>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {APPOINTMENT_TIPO_LABEL[appt.tipo]}
                    </div>
                  </div>
                  <StatusChip status={appt.status} />
                </div>
              </SheetHeader>

              {/* ── Body ── */}
              <div className="p-6 space-y-5">

                {/* Date / Time */}
                <InfoRow icon={<CalendarIcon className="size-4" />} label="Fecha y hora">
                  <span className="capitalize">
                    {format(toBADate(appt.scheduled_at), "EEEE d 'de' MMMM, HH:mm 'hs'", { locale: es })}
                  </span>
                </InfoRow>

                {/* Duration */}
                <InfoRow icon={<Clock className="size-4" />} label="Duración">
                  {appt.duration_min < 60
                    ? `${appt.duration_min} min`
                    : `${appt.duration_min / 60} h`}
                </InfoRow>

                {/* Lugar */}
                {appt.lugar && (
                  <InfoRow icon={<MapPin className="size-4" />} label="Lugar">
                    {appt.lugar}
                  </InfoRow>
                )}

                {/* Vendedor */}
                {(appt.vendedor_alias || appt.vendedor_nombre) && (
                  <InfoRow icon={<User className="size-4" />} label="Vendedor">
                    {appt.vendedor_alias || appt.vendedor_nombre}
                  </InfoRow>
                )}

                {/* Modelo */}
                {appt.modelo_interes && (
                  <InfoRow icon={<span className="size-4 text-center text-xs font-bold leading-4">🚗</span>} label="Modelo de interés">
                    {appt.modelo_interes}
                  </InfoRow>
                )}

                {/* Notas */}
                {appt.notas && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                    {appt.notas}
                  </div>
                )}

                {/* Outcome notes */}
                {appt.outcome_notes && (
                  <div>
                    <div className="text-xs text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">
                      Notas de resultado
                    </div>
                    <div className="text-sm">{appt.outcome_notes}</div>
                  </div>
                )}

                {/* Go to lead */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-full"
                  onClick={() => setOpenLeadId(appt.lead_id)}
                >
                  <ExternalLink className="size-3.5" />
                  Ver ficha del lead
                </Button>

                {/* Actions — only for programada */}
                {appt.status === 'programada' && (
                  <div className="border-t border-border pt-4 space-y-2">
                    <Button
                      size="sm"
                      className="gap-1.5 w-full"
                      disabled={isPending}
                      onClick={() => run(
                        () => markAppointmentDone(appt.id),
                        'Cita marcada como realizada',
                      )}
                    >
                      {isPending
                        ? <Loader2 className="size-3.5 animate-spin" />
                        : <CheckCircle2 className="size-3.5" />}
                      Marcar como realizada
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={isPending}
                      onClick={() => run(
                        () => cancelAppointment(appt.id),
                        'Cita cancelada',
                      )}
                    >
                      <X className="size-3.5" />
                      Cancelar cita
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Nested lead sheet — mounts on top */}
      <LeadDetailSheet
        leadId={openLeadId}
        onClose={() => setOpenLeadId(null)}
      />
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────

function InfoRow({ icon, label, children }: {
  icon:     React.ReactNode
  label:    string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div>
        <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className="text-sm font-medium">{children}</div>
      </div>
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  programada:     'bg-violet-100 text-violet-700 border-violet-200/60',
  realizada:      'bg-emerald-100 text-emerald-700 border-emerald-200/60',
  no_se_presento: 'bg-destructive/10 text-destructive border-destructive/20',
  reagendada:     'bg-amber-100 text-amber-700 border-amber-200/60',
  cancelada:      'bg-muted text-muted-foreground border-border',
}

function StatusChip({ status }: { status: string }) {
  const label = APPOINTMENT_STATUS_LABEL[status as keyof typeof APPOINTMENT_STATUS_LABEL] ?? status
  return (
    <span className={cn(
      'inline-flex items-center text-[11px] font-medium rounded-full border px-2.5 py-1 shrink-0',
      STATUS_COLOR[status] ?? 'bg-muted text-muted-foreground border-border',
    )}>
      {label}
    </span>
  )
}
