import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'
import { tenants, usuarios } from './tenants'

const timestamps = {
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const equipos = pgTable('equipos', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(), // "Equipo Norte", "Equipo VIP"
  gerente_id: uuid('gerente_id').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  supervisor_id: uuid('supervisor_id').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  activo: boolean('activo').default(true).notNull(),
  ...timestamps,
})
