import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { appointmentTipoEnum, appointmentStatusEnum } from './enums'
import { tenants, usuarios } from './tenants'
import { equipos } from './equipos'
import { leads } from './leads'

// ─── Citas (lead_appointments) ───────────────────────────────────────────────
// Una cita es un evento programado con un lead (test drive, visita al showroom,
// videollamada, entrega). Es el evento más importante del negocio.
// Constraint a nivel DB: solo UNA cita con status='programada' por lead.

export const leadAppointments = pgTable(
  'lead_appointments',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    tenant_id:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    lead_id:    uuid('lead_id').notNull().references(() => leads.id,    { onDelete: 'cascade' }),
    vendedor_id: uuid('vendedor_id').references(() => usuarios.id,      { onDelete: 'set null' }),
    equipo_id:   uuid('equipo_id').references(() => equipos.id,         { onDelete: 'set null' }),

    scheduled_at:   timestamp('scheduled_at',   { withTimezone: true }).notNull(),
    duration_min:   integer('duration_min').notNull().default(60),
    tipo:           appointmentTipoEnum('tipo').notNull(),
    lugar:          text('lugar'),
    modelo_interes: text('modelo_interes'),
    notas:          text('notas'),

    status:         appointmentStatusEnum('status').notNull().default('programada'),
    outcome_notes:  text('outcome_notes'),

    created_by: uuid('created_by').references(() => usuarios.id, { onDelete: 'set null' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_appt_lead_scheduled').on(t.lead_id, t.scheduled_at),
    index('idx_appt_vendedor_scheduled').on(t.vendedor_id, t.scheduled_at),
    index('idx_appt_equipo_scheduled').on(t.equipo_id, t.scheduled_at),
    index('idx_appt_tenant_scheduled').on(t.tenant_id, t.scheduled_at),
    // Único parcial: una sola cita 'programada' por lead
    uniqueIndex('uq_one_live_appt_per_lead')
      .on(t.lead_id)
      .where(sql`status = 'programada'`),
  ],
)
