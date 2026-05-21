/**
 * scripts/seed-tenant-members.ts
 *
 * Llena tenant_members con todos los usuarios de `usuarios`
 * (excepto platform_admin) usando el único tenant existente.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/seed-tenant-members.ts
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, ne } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

// ── Conexión directa (no usa el singleton de Next.js) ─────────

const url = process.env.DATABASE_URL
if (!url) {
  console.error('❌  DATABASE_URL no está definida. Ejecutá con --env-file=.env.local')
  process.exit(1)
}

const client = postgres(url, { prepare: false, max: 1 })
const db = drizzle(client, { schema })

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('🔍  Buscando tenant...')

  const tenants = await db.select().from(schema.tenants)

  if (tenants.length === 0) {
    console.error('❌  No hay ningún tenant en la tabla `tenants`. Creá uno primero.')
    process.exit(1)
  }
  if (tenants.length > 1) {
    console.log(`⚠️   Hay ${tenants.length} tenants. Se usará el primero: "${tenants[0].nombre}" (${tenants[0].id})`)
    console.log('     Si querés usar otro, editá el script y especificá el ID manualmente.')
  }

  const tenant = tenants[0]
  console.log(`✅  Tenant: "${tenant.nombre}" — ${tenant.id}`)

  // ── Todos los usuarios que NO son platform_admin ─────────────
  const usuarios = await db
    .select()
    .from(schema.usuarios)
    .where(eq(schema.usuarios.is_platform_admin, false))

  if (usuarios.length === 0) {
    console.log('ℹ️   No hay usuarios (non-platform_admin) en la tabla `usuarios`.')
    process.exit(0)
  }

  console.log(`\n👥  Usuarios encontrados: ${usuarios.length}`)
  for (const u of usuarios) {
    console.log(`   • ${u.nombre} <${u.email}> — rol: ${u.rol}`)
  }

  // ── Verificar cuáles ya existen en tenant_members ─────────────
  const existing = await db
    .select({ user_id: schema.tenantMembers.user_id })
    .from(schema.tenantMembers)
    .where(eq(schema.tenantMembers.tenant_id, tenant.id))

  const existingIds = new Set(existing.map((r) => r.user_id))

  const toInsert = usuarios.filter((u) => !existingIds.has(u.id))
  const skipped  = usuarios.filter((u) =>  existingIds.has(u.id))

  if (skipped.length > 0) {
    console.log(`\n⏭️   Ya existen en tenant_members (se omiten):`)
    for (const u of skipped) {
      console.log(`   • ${u.nombre} <${u.email}>`)
    }
  }

  if (toInsert.length === 0) {
    console.log('\n✅  Todos los usuarios ya están en tenant_members. Nada que hacer.')
    process.exit(0)
  }

  // ── Insert ────────────────────────────────────────────────────
  console.log(`\n📝  Insertando ${toInsert.length} miembro(s)...`)

  const rows = toInsert.map((u) => ({
    tenant_id:         tenant.id,
    user_id:           u.id,
    rol:               u.rol,       // usa el rol que ya tiene en `usuarios`
    equipo_id:         null,
    activo:            u.activo,    // respeta el activo del usuario
    invitation_status: 'accepted' as const,
    invited_at:        new Date(),
    accepted_at:       new Date(),
  }))

  await db.insert(schema.tenantMembers).values(rows)

  console.log('\n🎉  Listo! Miembros insertados:')
  for (const u of toInsert) {
    console.log(`   ✓ ${u.nombre} <${u.email}> — rol: ${u.rol}`)
  }

  await client.end()
}

main().catch((err) => {
  console.error('❌  Error inesperado:', err)
  process.exit(1)
})
