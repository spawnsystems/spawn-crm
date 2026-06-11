import { z } from 'zod'

export const leadSourceValues = [
  'Meta Ads', 'Mercado Libre', 'Sitio web', 'Referido',
  'Visita al local', 'Contacto directo', 'Otro',
] as const

// Estado inicial: lead recién creado, todavía sin ningún contacto.
// No es un target seleccionable manualmente; el lead lo abandona en cuanto
// hay una primera interacción (llamada, cita, etc.).
export const initialStatusValue = 'NUEVO' as const

// Estados activos del pipeline (seleccionables para avanzar el lead)
export const activeStatusValues = [
  'GESTION', 'HORARIO ASIGNADO', 'ENTREVISTA PACTADA', 'CIERRE', 'VENTA',
] as const

// Estados de baja / terminales negativos (solo vía "Dar de baja" con motivo)
export const bajaStatusValues = [
  'NO CONTESTA', 'NO INTERESADO', 'INCONTACTABLE', 'YA COMPRO', 'DATO ERRONEO', 'DERIVAR',
] as const

// Universo completo del enum lead_status (NUEVO primero como estado inicial)
export const leadStatusValues = [
  initialStatusValue, ...activeStatusValues, ...bajaStatusValues,
] as const

// Rango horario de preferencia (puede haber varios). `days` opcional: 0=Lun … 6=Dom.
export const horarioRangeSchema = z.object({
  from: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  to:   z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  days: z.array(z.number().int().min(0).max(6)).optional(),
})

// Usado en parte de pago al crear el lead.
//   Obligatorios: marca y año.
//   Opcionales:   km, uso, valor InfoAuto.
// Si vienen km + valor InfoAuto, alcanza para cotizar y la cotización se genera
// automáticamente; si no, los parciales quedan como borrador y pre-cargan el
// cotizador desde la ficha del lead.
export const usadoInlineSchema = z.object({
  marca_modelo:  z.string().min(1, 'La marca es requerida').max(150),
  anio:          z.number().int().min(1900).max(new Date().getFullYear() + 1),
  km:            z.number().int().min(0).optional(),
  uso:           z.enum(['particular', 'taxi_uber_transporte']).optional(),
  base_infoauto: z.number().positive().optional(),
})

export const createLeadSchema = z.object({
  nombre:               z.string().min(2, 'El nombre es requerido'),
  telefono:             z.string().min(6, 'El teléfono es requerido'),
  email:                z.string().email('Email inválido').optional().or(z.literal('')),
  // Opcional: el lead puede entrar sin un modelo definido todavía ("Sin definir").
  modelo:               z.string().optional(),
  source:               z.enum(leadSourceValues, { errorMap: () => ({ message: 'Seleccioná el origen del lead' }) }),
  source_custom:        z.string().optional(),
  localidad:            z.string().min(2, 'La localidad es requerida'),
  provincia:            z.string().min(2, 'La provincia es requerida'),
  // Rangos horarios; se serializan a JSON en la columna text horario_preferencia.
  horarios:             z.array(horarioRangeSchema).optional(),
  tiene_usado:          z.boolean().default(false),
  // Cotización del usado a crear junto con el lead (opcional aunque tiene_usado).
  usado:                usadoInlineSchema.optional(),
  observaciones:        z.string().optional(),
  est_value:            z.number().positive().optional(),
  next_action:          z.string().optional(),
  assigned_to:          z.string().uuid().optional(),
  // Asignación a un equipo sin vendedor (gerente/dueño): el lead queda en la
  // bandeja de ese equipo para que el supervisor lo derive luego. Se ignora si
  // viene assigned_to (el vendedor manda).
  equipo_id:            z.string().uuid().optional(),
})

export const updateLeadSchema = z.object({
  nombre:               z.string().min(2).optional(),
  telefono:             z.string().optional(),
  email:                z.string().email().optional().or(z.literal('')),
  modelo:               z.string().nullable().optional(),
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
