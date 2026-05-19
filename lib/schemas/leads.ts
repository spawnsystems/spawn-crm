import { z } from 'zod'

export const leadSourceValues = [
  'Meta Ads', 'Mercado Libre', 'Web', 'Referido', 'Walk-in', 'Otro',
] as const

export const leadStatusValues = [
  'Nuevo', 'Contactado', 'Cotizado', 'Test drive', 'Negociación', 'Cerrado', 'Perdido',
] as const

export const createLeadSchema = z.object({
  nombre:      z.string().min(2, 'El nombre es requerido'),
  telefono:    z.string().optional(),
  email:       z.string().email('Email inválido').optional().or(z.literal('')),
  modelo:      z.string().optional(),
  source:      z.enum(leadSourceValues).default('Otro'),
  est_value:   z.number().positive().optional(),
  next_action: z.string().optional(),
  assigned_to: z.string().uuid().optional(), // vendedor asignado (opcional)
})

export const updateLeadSchema = z.object({
  nombre:      z.string().min(2).optional(),
  telefono:    z.string().optional(),
  email:       z.string().email().optional().or(z.literal('')),
  modelo:      z.string().optional(),
  source:      z.enum(leadSourceValues).optional(),
  est_value:   z.number().positive().optional(),
  next_action: z.string().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
})

export const changeStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(leadStatusValues),
})

export type CreateLeadInput  = z.infer<typeof createLeadSchema>
export type UpdateLeadInput  = z.infer<typeof updateLeadSchema>
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>
