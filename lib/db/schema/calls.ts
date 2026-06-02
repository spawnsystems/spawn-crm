import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { tenants, usuarios } from './tenants'
import { leads } from './leads'

// ─── Llamadas coordinadas ─────────────────────────────────────────────────────
// No van al calendario. Viven exclusivamente en el detalle del lead.

export const leadCalls = pgTable('lead_calls', {
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
  outcome:         text('outcome'),          // 'proxima_llamada' | 'cita' | 'descartado'
  notas_resultado: text('notas_resultado'),
  created_at:      timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
