import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants, usuarios } from './tenants'
import { leads } from './leads'

// ─── Llamadas coordinadas ─────────────────────────────────────────────────────
// No van al calendario. Viven exclusivamente en el detalle del lead.
// Estados: pendiente (realizada_at IS NULL AND canceled_at IS NULL),
//          realizada (realizada_at IS NOT NULL),
//          cancelada (canceled_at IS NOT NULL → reemplazada por otra agenda).
// Constraint a nivel DB: una sola llamada PENDIENTE por lead.

export const leadCalls = pgTable(
  'lead_calls',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    tenant_id:       uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    lead_id:         uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    created_by:      uuid('created_by')
      .references(() => usuarios.id, { onDelete: 'set null' }),
    scheduled_at:    timestamp('scheduled_at', { withTimezone: true }).notNull(),
    notas_previas:   text('notas_previas'),
    // Post-llamada (null = pendiente)
    realizada_at:    timestamp('realizada_at', { withTimezone: true }),
    // Cancelada/reemplazada por una agenda posterior (null = no cancelada)
    canceled_at:     timestamp('canceled_at', { withTimezone: true }),
    outcome:         text('outcome'),          // 'no_contesto' | 'sin_avance' | 'proxima_llamada' | 'cita' | 'descartado'
    notas_resultado: text('notas_resultado'),
    created_at:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Única parcial: una sola llamada 'pendiente' (sin registrar ni cancelar) por lead.
    uniqueIndex('uq_one_pending_call_per_lead')
      .on(t.lead_id)
      .where(sql`realizada_at IS NULL AND canceled_at IS NULL`),
  ],
)
