import {
  pgTable,
  uuid,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { transferStatusEnum } from './enums'
import { tenants, usuarios } from './tenants'
import { leads } from './leads'

// ─── Traspasos de leads ───────────────────────────────────────────────────────

export const leadTransfers = pgTable('lead_transfers', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenant_id:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  lead_id:      uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  from_user_id: uuid('from_user_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  to_user_id:   uuid('to_user_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  // Quién debe aprobar: supervisor del equipo → gerente → dueño (resuelto al crear).
  approver_id:  uuid('approver_id').references(() => usuarios.id, { onDelete: 'set null' }),
  status:       transferStatusEnum('status').notNull().default('pendiente'),
  motivo:       text('motivo'),
  responded_at: timestamp('responded_at', { withTimezone: true }),
  created_at:   timestamp('created_at',   { withTimezone: true }).defaultNow().notNull(),
})

// ─── Notificaciones in-app ────────────────────────────────────────────────────

export const notifications = pgTable('notifications', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenant_id:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  user_id:    uuid('user_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  kind:       text('kind').notNull(),   // 'transfer_request' | 'transfer_accepted' | 'transfer_rejected'
  title:      text('title').notNull(),
  body:       text('body'),
  entity:     text('entity'),           // 'lead_transfer'
  entity_id:  uuid('entity_id'),
  read_at:    timestamp('read_at',    { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
