import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'
import { appRoleEnum, invitationStatusEnum, moduleKeyEnum } from './enums'

const timestamps = {
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

// ─── Tenants (concesionarias) ────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  concesionaria: text('concesionaria').notNull(), // marca: Chevrolet, Ford, etc.
  logo_url: text('logo_url'),
  color_primario: text('color_primario').default('#2563eb'),
  activo: boolean('activo').default(true).notNull(),
  plan_key: text('plan_key').default('starter').notNull(),
  cotizacion_config: jsonb('cotizacion_config'), // config extra en JSON
  sla_config: jsonb('sla_config'), // { primerContactoHoras, sinContactoDias }
  ...timestamps,
})

// ─── Usuarios (espejo de auth.users + perfil app) ────────────────────────────

export const usuarios = pgTable('usuarios', {
  // id = auth.users.id (UUID de Supabase Auth)
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  nombre: text('nombre').notNull(),
  alias: text('alias'),
  rol: appRoleEnum('rol').notNull().default('vendedor'),
  is_platform_admin: boolean('is_platform_admin').default(false).notNull(),
  activo: boolean('activo').default(true).notNull(),
  ...timestamps,
})

// ─── Módulos por tenant ──────────────────────────────────────────────────────

export const tenantModules = pgTable(
  'tenant_modules',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    tenant_id:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    module_key: moduleKeyEnum('module_key').notNull(),
    enabled:    boolean('enabled').notNull().default(true),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('tenant_modules_tenant_module_uq').on(t.tenant_id, t.module_key)],
)

// ─── Membresías (usuario ↔ tenant) ──────────────────────────────────────────

export const tenantMembers = pgTable('tenant_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  rol: appRoleEnum('rol').notNull(),
  equipo_id: uuid('equipo_id'), // FK a equipos — se completa después (FK circular)
  activo: boolean('activo').default(true).notNull(),
  invitation_status: invitationStatusEnum('invitation_status')
    .default('pending')
    .notNull(),
  invited_at: timestamp('invited_at', { withTimezone: true }).defaultNow(),
  accepted_at: timestamp('accepted_at', { withTimezone: true }),
  ...timestamps,
})
