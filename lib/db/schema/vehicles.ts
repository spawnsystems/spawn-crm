import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

const timestamps = {
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const modelosVehiculo = pgTable('modelos_vehiculo', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),        // "Chevrolet Tracker"
  motor: text('motor'),                    // "1.2T Turbo"
  transmision: text('transmision'),        // "Automática 6 vel"
  consumo: text('consumo'),               // "13.5 km/l"
  precio: numeric('precio', { precision: 14, scale: 2 }),
  stock: integer('stock').default(0),
  colores: text('colores').array(),        // ["Blanco Artic", "Negro Onyx"]
  ...timestamps,
})
