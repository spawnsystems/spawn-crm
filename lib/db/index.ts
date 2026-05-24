// ============================================================
// lib/db/index.ts
// Cliente Drizzle + wrapper tenant-aware
//
// Dos clientes:
// - dbAdmin: service-role equivalent (via direct postgres connection).
//   Bypasea RLS. Usar SOLO en /platform, onboarding y auth server actions.
// - db(tenantId): wrapper sobre dbAdmin que inyecta el tenant_id en queries.
//   Usar en TODOS los server actions de negocio.
//
// Nota: DATABASE_URL = Transaction Pooler de Supabase (port 6543).
// Requiere prepare: false por PgBouncer.
// ============================================================

import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, type SQL } from 'drizzle-orm'
import postgres from 'postgres'
import * as schema from './schema'

// ── Cliente base ──────────────────────────────────────────────
function createDbClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL no está configurado. ' +
        'Agregá la connection string de Supabase (Transaction Pooler) en .env.local',
    )
  }
  const client = postgres(process.env.DATABASE_URL, {
    prepare: false,   // requerido para PgBouncer (Transaction mode)
    max: 1,           // 1 conexión por instancia (serverless-safe)
    idle_timeout: 20,
    connect_timeout: 10,
  })
  return drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' })
}

// Lazy singleton — NO se instancia en module evaluation (build time).
// Se crea la primera vez que se llama dbAdmin, no al importar el módulo.
const globalForDb = globalThis as unknown as { _drizzle?: ReturnType<typeof createDbClient> }

function getDbAdmin() {
  if (!globalForDb._drizzle) {
    globalForDb._drizzle = createDbClient()
  }
  return globalForDb._drizzle
}

/* eslint-disable
   @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call
   --
   El Proxy necesita `any` para reenviar propiedades dinámicas al cliente Drizzle.
   Esta es la única excepción permitida en el proyecto para `any`. */
export const dbAdmin = new Proxy({} as ReturnType<typeof createDbClient>, {
  get(_target, prop) {
    const instance = getDbAdmin()
    const value = (instance as any)[prop]
    // Bindear funciones para que no pierdan el contexto de `this`
    return typeof value === 'function' ? value.bind(instance) : value
  },
})
/* eslint-enable
   @typescript-eslint/no-explicit-any,
   @typescript-eslint/no-unsafe-assignment,
   @typescript-eslint/no-unsafe-member-access,
   @typescript-eslint/no-unsafe-return,
   @typescript-eslint/no-unsafe-call */

// ── Tipos inferidos del schema ────────────────────────────────
export type Tenant        = typeof schema.tenants.$inferSelect
export type TenantInsert  = typeof schema.tenants.$inferInsert
export type TenantMember  = typeof schema.tenantMembers.$inferSelect
export type Usuario       = typeof schema.usuarios.$inferSelect
export type UsuarioInsert = typeof schema.usuarios.$inferInsert
export type Equipo        = typeof schema.equipos.$inferSelect
export type Lead          = typeof schema.leads.$inferSelect
export type LeadInsert    = typeof schema.leads.$inferInsert
export type LeadNote      = typeof schema.leadNotes.$inferSelect
export type LeadTimeline  = typeof schema.leadTimeline.$inferSelect
export type LeadTask      = typeof schema.leadTasks.$inferSelect
export type ModeloVehiculo = typeof schema.modelosVehiculo.$inferSelect

// Audit & config
export type AuditLog         = typeof schema.auditLogs.$inferSelect
export type EmailLog         = typeof schema.emailLog.$inferSelect
export type NotificationPrefs = typeof schema.notificationPrefs.$inferSelect
export type MetaMensual      = typeof schema.metasMensuales.$inferSelect
export type MetaMensualInsert = typeof schema.metasMensuales.$inferInsert
export type LeadSourceCustom = typeof schema.leadSourcesCustom.$inferSelect

// ── Wrapper tenant-aware ──────────────────────────────────────
// Uso en server actions:
//
//   const { q, tenantId, forTenant } = db(currentTenantId)
//   const rows = await q.select().from(schema.leads).where(forTenant(schema.leads))
//
export function db(tenantId: string) {
  return {
    /** El cliente Drizzle subyacente */
    q: dbAdmin,

    /** El tenant_id activo (para incluir en inserts) */
    tenantId,

    /**
     * Condición WHERE que filtra por tenant_id para una tabla.
     * La tabla debe tener una columna `tenant_id`.
     * Arrow function — no usa `this`, segura para destructuring.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    forTenant: (table: { tenant_id: any }): SQL => eq(table.tenant_id, tenantId),
  }
}

// Re-export del schema para facilitar imports en server actions
export { schema }
