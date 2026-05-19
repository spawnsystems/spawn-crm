/**
 * lib/tenant/server.ts
 * Helpers server-only para obtener datos del tenant activo.
 * NUNCA importar desde client components.
 */

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { PREVIEW_COOKIE } from '@/lib/constants'

// ── Tipos ─────────────────────────────────────────────────────

export interface TenantData {
  id:             string
  nombre:         string
  concesionaria:  string
  plan_key:       string
  color_primario: string | null
  logo_url:       string | null
  activo:         boolean
}

// ── getMembershipState ────────────────────────────────────────

export async function getMembershipState(): Promise<'active' | 'inactive' | 'none'> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'none'

  const rows = await dbAdmin
    .select({ activo: schema.tenantMembers.activo })
    .from(schema.tenantMembers)
    .where(eq(schema.tenantMembers.user_id, user.id))

  if (rows.length === 0) return 'none'
  if (rows.some((r) => r.activo)) return 'active'
  return 'inactive'
}

// ── getCurrentTenantId ────────────────────────────────────────

export const getCurrentTenantId = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Platform admin preview: si hay cookie de preview, usarla
  const cookieStore = await cookies()
  const previewId = cookieStore.get(PREVIEW_COOKIE)?.value
  if (previewId) {
    const adminRow = await dbAdmin
      .select({ is_platform_admin: schema.usuarios.is_platform_admin })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, user.id))
      .limit(1)
    if (adminRow[0]?.is_platform_admin) return previewId
  }

  const rows = await dbAdmin
    .select({ tenant_id: schema.tenantMembers.tenant_id })
    .from(schema.tenantMembers)
    .where(
      and(
        eq(schema.tenantMembers.user_id, user.id),
        eq(schema.tenantMembers.activo, true),
      ),
    )
    .limit(1)

  return rows[0]?.tenant_id ?? null
})

// ── getCurrentTenant ──────────────────────────────────────────

export const getCurrentTenant = cache(async (): Promise<TenantData | null> => {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return null

  const rows = await dbAdmin
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId))
    .limit(1)

  const tenant = rows[0]
  if (!tenant) return null

  return {
    id:             tenant.id,
    nombre:         tenant.nombre,
    concesionaria:  tenant.concesionaria,
    plan_key:       tenant.plan_key,
    color_primario: tenant.color_primario ?? null,
    logo_url:       tenant.logo_url ?? null,
    activo:         tenant.activo,
  }
})
