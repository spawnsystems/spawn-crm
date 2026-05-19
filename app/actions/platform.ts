'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { PREVIEW_COOKIE } from '@/lib/constants'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { dbAdmin, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import type { ActionResult } from './auth'

// ── Preview mode ──────────────────────────────────────────────

export async function enterPreviewMode(tenantId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) redirect('/login')

  const cookieStore = await cookies()
  cookieStore.set(PREVIEW_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function exitPreviewMode(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PREVIEW_COOKIE)
  revalidatePath('/', 'layout')
  redirect('/platform')
}

// ── Tenants CRUD (platform admin) ────────────────────────────

export async function listTenants(): Promise<ActionResult<typeof schema.tenants.$inferSelect[]>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const rows = await dbAdmin
    .select()
    .from(schema.tenants)
    .orderBy(schema.tenants.created_at)

  return { success: true, data: rows }
}

export async function createTenant(input: {
  nombre: string
  concesionaria: string
  color_primario?: string
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  if (!input.nombre?.trim()) return { success: false, error: 'El nombre es requerido' }
  if (!input.concesionaria?.trim()) return { success: false, error: 'La concesionaria es requerida' }

  const [row] = await dbAdmin
    .insert(schema.tenants)
    .values({
      nombre:        input.nombre.trim(),
      concesionaria: input.concesionaria.trim(),
      color_primario: input.color_primario ?? '#2563eb',
      activo:        true,
      plan_key:      'starter',
    })
    .returning({ id: schema.tenants.id })

  revalidatePath('/platform')
  return { success: true, data: { id: row.id } }
}

export async function suspendTenant(tenantId: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  await dbAdmin
    .update(schema.tenants)
    .set({ activo: false })
    .where(eq(schema.tenants.id, tenantId))

  revalidatePath('/platform')
  return { success: true, data: undefined }
}

export async function reactivateTenant(tenantId: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  await dbAdmin
    .update(schema.tenants)
    .set({ activo: true })
    .where(eq(schema.tenants.id, tenantId))

  revalidatePath('/platform')
  return { success: true, data: undefined }
}
