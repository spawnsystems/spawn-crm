import { z } from 'zod'

// ── Modelos vehiculo ──────────────────────────────────────────

export const modeloSchema = z.object({
  nombre:      z.string().min(1, 'El nombre es requerido').max(100),
  motor:       z.string().max(80).optional(),
  transmision: z.string().max(80).optional(),
  consumo:     z.string().max(40).optional(),
  precio:      z.number().positive().optional().nullable(),
  stock:       z.number().int().min(0).max(9999).optional().nullable(),
})

export type ModeloInput = z.infer<typeof modeloSchema>

// ── Fuentes custom ────────────────────────────────────────────

export const sourceCustomSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
})

export type SourceCustomInput = z.infer<typeof sourceCustomSchema>

// ── Metas mensuales ───────────────────────────────────────────

export const metaVentasSchema = z.object({
  user_id:     z.string().uuid(),
  anio:        z.number().int().min(2020).max(2100),
  mes:         z.number().int().min(1).max(12),
  meta_ventas: z.number().int().min(0).max(9999),
})

export type MetaVentasInput = z.infer<typeof metaVentasSchema>

// ── Tenant info ───────────────────────────────────────────────

export const tenantInfoSchema = z.object({
  nombre:        z.string().min(1, 'El nombre es requerido').max(100),
  concesionaria: z.string().min(1, 'La marca es requerida').max(100),
})

export type TenantInfoInput = z.infer<typeof tenantInfoSchema>
