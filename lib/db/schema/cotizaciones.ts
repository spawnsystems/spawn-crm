import {
  pgTable, uuid, text, boolean, numeric, integer, timestamp, pgEnum,
} from 'drizzle-orm/pg-core'
import { tenants, usuarios } from './tenants'
import { leads } from './leads'

export const usadoUsoEnum = pgEnum('usado_uso', ['particular', 'taxi_uber_transporte'])

// ─── Cotizaciones de usados ───────────────────────────────────────────────────

export const cotizaciones = pgTable('cotizaciones', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenant_id:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  lead_id:         uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),

  // Datos del vehículo
  marca_modelo:    text('marca_modelo'),
  anio:            integer('anio'),
  km:              integer('km'),
  uso:             usadoUsoEnum('uso').notNull().default('particular'),

  // Cálculo
  base_infoauto:   numeric('base_infoauto', { precision: 14, scale: 2 }).notNull(),
  descuento_pct:   numeric('descuento_pct', { precision: 5, scale: 2 }),
  valor_calculado: numeric('valor_calculado', { precision: 14, scale: 2 }),
  override_valor:  numeric('override_valor', { precision: 14, scale: 2 }),
  valor_final:     numeric('valor_final', { precision: 14, scale: 2 }).notNull(),

  // Estado
  rechazado:       boolean('rechazado').notNull().default(false),
  rechazo_motivo:  text('rechazo_motivo'),
  condiciones:     text('condiciones'),

  // Auditoría
  created_by:      uuid('created_by').references(() => usuarios.id, { onDelete: 'set null' }),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at:      timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Registro de ventas ───────────────────────────────────────────────────────

export const registroVentas = pgTable('registro_ventas', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenant_id:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  lead_id:         uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  vendedor_id:     uuid('vendedor_id').references(() => usuarios.id, { onDelete: 'set null' }),

  modelo:          text('modelo'),
  monto:           numeric('monto', { precision: 14, scale: 2 }),
  usado_tomado_id: uuid('usado_tomado_id').references(() => cotizaciones.id, { onDelete: 'set null' }),

  // Datos del comprador confirmados al cerrar la venta (snapshot)
  comprador_telefono:     text('comprador_telefono'),
  comprador_telefono_alt: text('comprador_telefono_alt'),
  comprador_dni:          text('comprador_dni'),
  comprador_email:        text('comprador_email'),

  vendida_at:      timestamp('vendida_at', { withTimezone: true }).defaultNow().notNull(),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
