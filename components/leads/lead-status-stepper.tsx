'use client'

import { cn } from '@/lib/utils'
import { isBaja, statusLabel } from '@/lib/leads/constants'

const STEPS = ['NUEVO', 'GESTION', 'HORARIO ASIGNADO', 'ENTREVISTA PACTADA', 'CIERRE', 'VENTA'] as const
type Step = (typeof STEPS)[number]

const STEP_INDEX: Record<Step, number> = {
  'NUEVO':              0,
  'GESTION':            1,
  'HORARIO ASIGNADO':   2,
  'ENTREVISTA PACTADA': 3,
  'CIERRE':             4,
  'VENTA':              5,
}

// Labels cortos para el stepper (el badge usa los largos)
const STEP_LABEL: Record<Step, string> = {
  'NUEVO':              'Nuevo',
  'GESTION':            'Gestión',
  'HORARIO ASIGNADO':   'Horario',
  'ENTREVISTA PACTADA': 'Entrevista',
  'CIERRE':             'Cierre',
  'VENTA':              'Venta',
}

interface LeadStatusStepperProps {
  status:     string   // Lead['status']
  wasRescued: boolean  // timeline has at least one 'reactivated_from_rescue' event
  className?: string
}

export function LeadStatusStepper({ status, wasRescued, className }: LeadStatusStepperProps) {
  const enBaja       = isBaja(status)
  const currentIndex = enBaja ? -1 : (STEP_INDEX[status as Step] ?? -1)

  return (
    <div className={cn('select-none', className)}>
      {/* Stepper row */}
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const isCompleted = !enBaja && currentIndex > i
          const isCurrent   = !enBaja && currentIndex === i

          return (
            <div
              key={step}
              className={cn('flex items-start', i < STEPS.length - 1 && 'flex-1')}
            >
              {/* Dot + label */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={cn(
                  'size-3 rounded-full border-2 transition-colors',
                  isCurrent
                    ? 'bg-primary border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]'
                    : isCompleted
                    ? 'bg-primary border-primary'
                    : 'bg-background border-muted-foreground/25',
                )} />
                <span className={cn(
                  'text-[10px] font-medium leading-none whitespace-nowrap',
                  isCurrent   ? 'text-primary'
                  : isCompleted ? 'text-foreground/60'
                  : 'text-muted-foreground/40',
                )}>
                  {STEP_LABEL[step]}
                </span>
              </div>

              {/* Connector — between dots, vertically centred with dot (top 5px) */}
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-[2px] mt-[5px] mx-1.5 rounded-full transition-colors',
                  isCompleted ? 'bg-primary/40' : 'bg-muted-foreground/15',
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* Baja — pill claro en lugar de la rama colgante */}
      {enBaja && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
            <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
            Dado de baja · {statusLabel(status)}
          </span>
        </div>
      )}

      {/* Pasó por rescate pero está activo de nuevo */}
      {!enBaja && wasRescued && (
        <div className="mt-2 ml-[13px]">
          <span className="text-[10px] font-medium leading-none text-muted-foreground/50">
            ↳ Estuvo en rescate
          </span>
        </div>
      )}
    </div>
  )
}
