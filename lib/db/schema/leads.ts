import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
} from 'drizzle-orm/pg-core'
import { leadStatusEnum, leadSourceEnum, rescueCategoryEnum } from './enums'
import { tenants, usuarios } from './tenants'
import { equipos } from './equipos'

const timestamps = {
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

// ─── Leads ───────────────────────────────────────────────────────────────────

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  // Datos del prospecto
  nombre:               text('nombre').notNull(),
  telefono:             text('telefono'),
  email:                text('email'),
  modelo:               text('modelo'),
  source:               leadSourceEnum('source').default('Otro').notNull(),
  source_custom:        text('source_custom'),         // detalle cuando source='Otro'
  localidad:            text('localidad'),
  provincia:            text('provincia'),
  horario_preferencia:  text('horario_preferencia'),
  tiene_usado:          boolean('tiene_usado').default(false).notNull(),
  usado_marca:          text('usado_marca'),           // marca anotada al crear (antes de cotizar)
  usado_anio:           integer('usado_anio'),         // año anotado al crear
  usado_km:             integer('usado_km'),           // km parcial (borrador, opcional al crear)
  usado_uso:            text('usado_uso'),             // 'particular' | 'taxi_uber_transporte' (borrador)
  usado_valor_infoauto: numeric('usado_valor_infoauto', { precision: 14, scale: 2 }), // valor InfoAuto parcial
  observaciones:        text('observaciones'),

  // Estado y pipeline
  status: leadStatusEnum('status').default('NUEVO').notNull(),
  next_action: text('next_action'),
  est_value: numeric('est_value', { precision: 14, scale: 2 }),

  // Baja (estado terminal negativo, seteado vía "Dar de baja")
  baja_motivo: text('baja_motivo'),
  baja_at: timestamp('baja_at', { withTimezone: true }),

  // Riesgo y tiempo
  days_in_stage: integer('days_in_stage').default(0).notNull(),
  at_risk: boolean('at_risk').default(false).notNull(),
  last_contact_at: timestamp('last_contact_at', { withTimezone: true }),
  last_contact_critical: boolean('last_contact_critical').default(false).notNull(),
  stage_entered_at: timestamp('stage_entered_at', { withTimezone: true }).defaultNow().notNull(),

  // Rescate
  abandoned_at: timestamp('abandoned_at', { withTimezone: true }),
  rescue_category: rescueCategoryEnum('rescue_category'),

  // Asignación
  assigned_to: uuid('assigned_to').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  equipo_id: uuid('equipo_id').references(() => equipos.id, {
    onDelete: 'set null',
  }),

  // Auditoría
  created_by: uuid('created_by').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  updated_by: uuid('updated_by').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  ...timestamps,
})

// ─── Notas de lead ────────────────────────────────────────────────────────────

export const leadNotes = pgTable('lead_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  lead_id: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  author_id: uuid('author_id').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  texto: text('texto').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Timeline de lead ─────────────────────────────────────────────────────────

export const leadTimeline = pgTable('lead_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  lead_id: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  event_type: text('event_type').notNull(),
  // lead_created | status_changed | contacted | quoted |
  // test_drive_set | note_added | reassigned | task_done
  title: text('title').notNull(),
  description: text('description'),
  actor_id: uuid('actor_id').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Tareas de lead ───────────────────────────────────────────────────────────

export const leadTasks = pgTable('lead_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  lead_id: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  assigned_to: uuid('assigned_to').references(() => usuarios.id, {
    onDelete: 'set null',
  }),
  texto: text('texto').notNull(),
  due_at: timestamp('due_at', { withTimezone: true }),
  done: boolean('done').default(false).notNull(),
  kind: text('kind').default('task').notNull(), // 'task' | 'callback'
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
