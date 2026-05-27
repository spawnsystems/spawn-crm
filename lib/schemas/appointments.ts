import { z } from 'zod'

export const appointmentTipoValues = [
  'test_drive',
  'visita_showroom',
  'videollamada',
  'entrega',
] as const

export const appointmentStatusValues = [
  'programada',
  'realizada',
  'no_se_presento',
  'reagendada',
  'cancelada',
] as const

export type AppointmentTipo   = (typeof appointmentTipoValues)[number]
export type AppointmentStatus = (typeof appointmentStatusValues)[number]

// Labels para UI
export const APPOINTMENT_TIPO_LABEL: Record<AppointmentTipo, string> = {
  test_drive:      'Test drive',
  visita_showroom: 'Visita al showroom',
  videollamada:    'Videollamada',
  entrega:         'Entrega',
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  programada:     'Programada',
  realizada:      'Realizada',
  no_se_presento: 'No se presentó',
  reagendada:     'Reagendada',
  cancelada:      'Cancelada',
}

export const DURATIONS_MIN = [30, 60, 90, 120] as const

// ─── Schemas ─────────────────────────────────────────────────────────

export const createAppointmentSchema = z.object({
  lead_id:        z.string().uuid(),
  scheduled_at:   z.coerce.date()
    .refine((d) => d.getTime() > Date.now(), { message: 'La cita debe ser en el futuro' }),
  duration_min:   z.number().int().min(15).max(240).default(60),
  tipo:           z.enum(appointmentTipoValues),
  lugar:          z.string().max(200).optional(),
  modelo_interes: z.string().max(120).optional(),
  notas:          z.string().max(2000).optional(),
  vendedor_id:    z.string().uuid().optional(),
})

export const updateAppointmentSchema = z.object({
  scheduled_at:   z.coerce.date().optional(),
  duration_min:   z.number().int().min(15).max(240).optional(),
  tipo:           z.enum(appointmentTipoValues).optional(),
  lugar:          z.string().max(200).optional(),
  modelo_interes: z.string().max(120).optional(),
  notas:          z.string().max(2000).optional(),
})

export const rescheduleAppointmentSchema = z.object({
  newScheduledAt: z.coerce.date()
    .refine((d) => d.getTime() > Date.now(), { message: 'La nueva fecha debe ser futura' }),
  newDuration:    z.number().int().min(15).max(240).optional(),
})

export type CreateAppointmentInput     = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentInput     = z.infer<typeof updateAppointmentSchema>
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>
