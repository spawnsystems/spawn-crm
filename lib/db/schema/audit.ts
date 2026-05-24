import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core'
import { tenants, usuarios } from './tenants'

// ─── Audit logs ───────────────────────────────────────────────────────────────
// Registro de acciones del sistema. tenant_id nullable (NULL = platform_admin).
// Cada server action instrumentado llama a logAudit() desde lib/audit/log.ts.

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // NULL para acciones de platform_admin que no pertenecen a un tenant
  tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),

  actor_id: uuid('actor_id').references(() => usuarios.id, { onDelete: 'set null' }),

  // lead.create | lead.assign | lead.status_change | lead.mark_lost |
  // lead.contacted | user.invite | tenant.update | etc.
  action: text('action').notNull(),

  // lead | user | tenant | equipo | modelo | meta | source
  entity: text('entity').notNull(),

  entity_id: uuid('entity_id'),

  // Datos adicionales para contexto: { from, to, nombre, ... }
  meta: jsonb('meta'),

  // TRUE = visible en la UI del dueño; FALSE = solo en DB / auditoría interna
  visible_to_dueno: boolean('visible_to_dueno').notNull().default(false),

  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Email log ────────────────────────────────────────────────────────────────
// Seguimiento de emails enviados vía Resend.
// El webhook /api/webhooks/resend actualiza status, resend_id y error.

export const emailLog = pgTable('email_log', {
  id: uuid('id').primaryKey().defaultRandom(),

  // NULL para emails de sistema no asociados a un tenant (ej: invitación inicial)
  tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),

  to_email: text('to_email').notNull(),

  // invitation | task_reminder | lead_at_risk | daily_digest
  kind: text('kind').notNull(),

  subject: text('subject').notNull(),

  // ID devuelto por la API de Resend al enviar
  resend_id: text('resend_id'),

  // queued | sent | delivered | bounced | complained | failed
  status: text('status').notNull().default('queued'),

  error: text('error'),

  meta: jsonb('meta'),

  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ─── Notification prefs ───────────────────────────────────────────────────────
// Preferencias de notificación por usuario (1 fila por usuario).
// Se crea con defaults la primera vez que el usuario guarda preferencias.

export const notificationPrefs = pgTable('notification_prefs', {
  // PK = user_id (1 fila por usuario)
  user_id: uuid('user_id').primaryKey().references(() => usuarios.id, { onDelete: 'cascade' }),

  email_task_reminder: boolean('email_task_reminder').notNull().default(true),
  email_lead_at_risk:  boolean('email_lead_at_risk').notNull().default(true),
  email_daily_digest:  boolean('email_daily_digest').notNull().default(false),
  sound_enabled:       boolean('sound_enabled').notNull().default(true),

  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
