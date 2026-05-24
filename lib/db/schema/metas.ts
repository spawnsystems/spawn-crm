import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  unique,
} from 'drizzle-orm/pg-core'
import { tenants, usuarios } from './tenants'

// ─── Metas mensuales ─────────────────────────────────────────────────────────
// Meta de ventas (unidades + monto opcional) por vendedor por mes.
// UNIQUE (tenant_id, user_id, anio, mes) permite upsert limpio.

export const metasMensuales = pgTable(
  'metas_mensuales',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    user_id: uuid('user_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),

    anio:       integer('anio').notNull(),
    mes:        integer('mes').notNull(), // 1–12, CHECK constraint en SQL
    meta_ventas: integer('meta_ventas').notNull().default(0),
    meta_monto:  numeric('meta_monto', { precision: 14, scale: 2 }),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('metas_mensuales_uq').on(t.tenant_id, t.user_id, t.anio, t.mes)],
)

// ─── Lead sources custom ─────────────────────────────────────────────────────
// Fuentes de leads definidas por el tenant, además del enum global.
// Ejemplo: "Instagram Direct", "Feria 2025", "Recomendación cliente".
// UNIQUE (tenant_id, nombre) evita duplicados por tenant.

export const leadSourcesCustom = pgTable(
  'lead_sources_custom',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    tenant_id: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    nombre: text('nombre').notNull(),
    activo: boolean('activo').notNull().default(true),

    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('lead_sources_custom_uq').on(t.tenant_id, t.nombre)],
)
