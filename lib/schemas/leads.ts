import { z } from 'zod'

export const leadSourceValues = [
  'Meta Ads', 'Mercado Libre', 'Sitio web', 'Referido',
  'Visita al local', 'Contacto directo', 'Otro',
] as const

// Estados activos del pipeline (seleccionables para avanzar el lead)
export const activeStatusValues = [
  'GESTION', 'HORARIO ASIGNADO', 'ENTREVISTA PACTADA', 'CIERRE', 'VENTA',
] as const

// Estados de baja / terminales negativos (solo vía "Dar de baja" con motivo)
export const bajaStatusValues = [
  'NO CONTESTA', 'NO INTERESADO', 'INCONTACTABLE', 'YA COMPRO', 'DATO ERRONEO', 'DERIVAR',
] as const

// Universo completo del enum lead_status
export const leadStatusValues = [
  ...activeStatusValues, ...bajaStatusValues,
] as const

export const createLeadSchema = z.object({
  nombre:               z.string().min(2, 'El nombre es requerido'),
  telefono:             z.string().min(6, 'El teléfono es requerido'),
  email:                z.string().email('Email inválido').optional().or(z.literal('')),
  modelo:               z.string().min(1, 'El modelo de interés es requerido'),
  source:               z.enum(leadSourceValues, { errorMap: () => ({ message: 'Seleccioná el origen del lead' }) }),
  source_custom:        z.string().optional(),
  localidad:            z.string().min(2, 'La localidad es requerida'),
  provincia:            z.string().min(2, 'La provincia es requerida'),
  horario_preferencia:  z.string().optional(),
  tiene_usado:          z.boolean().default(false),
  observaciones:        z.string().optional(),
  est_value:            z.number().positive().optional(),
  next_action:          z.string().optional(),
  assigned_to:          z.string().uuid().optional(),
})

export const updateLeadSchema = z.object({
  nombre:               z.string().min(2).optional(),
  telefono:             z.string().optional(),
  email:                z.string().email().optional().or(z.literal('')),
  modelo:               z.string().optional(),
  source:               z.enum(leadSourceValues).optional(),
  source_custom:        z.string().optional(),
  localidad:            z.string().optional(),
  provincia:            z.string().optional(),
  horario_preferencia:  z.string().optional(),
  tiene_usado:          z.boolean().optional(),
  observaciones:        z.string().optional(),
  est_value:            z.number().positive().optional(),
  next_action:          z.string().optional(),
  assigned_to:          z.string().uuid().nullable().optional(),
})

// El cambio de estado "normal" solo permite avanzar entre estados activos.
// Los estados de baja se setean exclusivamente vía darDeBaja (bajaSchema).
export const changeStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(activeStatusValues),
})

// Dar de baja: estado terminal negativo + motivo obligatorio.
export const bajaSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(bajaStatusValues),
  motivo: z.string().min(3, 'El motivo es obligatorio'),
})

export type CreateLeadInput  = z.infer<typeof createLeadSchema>
export type UpdateLeadInput  = z.infer<typeof updateLeadSchema>
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>
export type BajaInput        = z.infer<typeof bajaSchema>
