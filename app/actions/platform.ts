'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { PREVIEW_COOKIE } from '@/lib/constants'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { dbAdmin, schema } from '@/lib/db'
import { eq, count, and } from 'drizzle-orm'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from './auth'
import type { AppRole } from '@/lib/auth/get-current-user'

// ── Tipos públicos ────────────────────────────────────────────

export type PlatformUserStatus = 'activo' | 'pendiente' | 'expirado' | 'inactivo' | 'baneado'

export interface UserRow {
  id:                string
  email:             string
  nombre:            string
  rol:               string
  is_platform_admin: boolean
  activo:            boolean
  isBanned:          boolean
  status:            PlatformUserStatus
  tenant_id:         string | null
  tenant_nombre:     string | null
  concesionaria:     string | null
  member_rol:        string | null
  invitation_status: string | null
  invited_at:        Date | null
}

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

export async function updateTenantInfo(
  tenantId: string,
  input: { nombre?: string; concesionaria?: string; color_primario?: string; plan_key?: string },
): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const updates: Record<string, string> = {}
  if (input.nombre?.trim())        updates.nombre        = input.nombre.trim()
  if (input.concesionaria?.trim()) updates.concesionaria = input.concesionaria.trim()
  if (input.color_primario)        updates.color_primario = input.color_primario
  if (input.plan_key)              updates.plan_key      = input.plan_key

  if (Object.keys(updates).length === 0) return { success: true, data: undefined }

  await dbAdmin.update(schema.tenants).set(updates).where(eq(schema.tenants.id, tenantId))

  revalidatePath('/platform')
  revalidatePath(`/platform/tenants/${tenantId}`)
  return { success: true, data: undefined }
}

// ── getTenantMembers (platform admin view) ────────────────────

export async function getTenantMembers(tenantId: string) {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return []

  return dbAdmin
    .select({
      user_id:           schema.tenantMembers.user_id,
      rol:               schema.tenantMembers.rol,
      activo:            schema.tenantMembers.activo,
      invitation_status: schema.tenantMembers.invitation_status,
      invited_at:        schema.tenantMembers.invited_at,
      nombre:            schema.usuarios.nombre,
      alias:             schema.usuarios.alias,
      email:             schema.usuarios.email,
    })
    .from(schema.tenantMembers)
    .leftJoin(schema.usuarios, eq(schema.tenantMembers.user_id, schema.usuarios.id))
    .where(eq(schema.tenantMembers.tenant_id, tenantId))
    .orderBy(schema.tenantMembers.rol, schema.usuarios.nombre)
}

// ── inviteUserToTenantAsAdmin ─────────────────────────────────
// Igual que inviteUserToTenant pero para platform admin sin necesitar preview mode

export async function inviteUserToTenantAsAdmin(
  tenantId: string,
  input: { email: string; nombre: string; rol: AppRole },
): Promise<ActionResult<{ userId: string }>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const email = input.email.toLowerCase().trim()
  if (!email.includes('@')) return { success: false, error: 'Email inválido' }
  if (!input.nombre.trim())  return { success: false, error: 'El nombre es requerido' }

  const adminClient = createAdminClient()
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  try {
    const existing = await dbAdmin
      .select({ id: schema.usuarios.id })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.email, email))
      .limit(1)

    let userId: string

    if (existing[0]) {
      userId = existing[0].id

      const alreadyMember = await dbAdmin
        .select({ id: schema.tenantMembers.id })
        .from(schema.tenantMembers)
        .where(and(
          eq(schema.tenantMembers.tenant_id, tenantId),
          eq(schema.tenantMembers.user_id, userId),
        ))
        .limit(1)

      if (alreadyMember[0]) {
        return { success: false, error: 'Este usuario ya es miembro del tenant' }
      }

      await dbAdmin.insert(schema.tenantMembers).values({
        tenant_id:         tenantId,
        user_id:           userId,
        rol:               input.rol,
        activo:            true,
        invitation_status: 'accepted',
      })
    } else {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm`,
        data: { nombre: input.nombre.trim(), rol: input.rol },
      })

      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('already') || msg.includes('registered')) {
          return { success: false, error: 'Este email ya tiene cuenta en la plataforma' }
        }
        return { success: false, error: `Error al invitar: ${error.message}` }
      }

      userId = data.user.id

      await dbAdmin
        .update(schema.usuarios)
        .set({ nombre: input.nombre.trim(), rol: input.rol })
        .where(eq(schema.usuarios.id, userId))

      await dbAdmin.insert(schema.tenantMembers).values({
        tenant_id:         tenantId,
        user_id:           userId,
        rol:               input.rol,
        activo:            false,
        invitation_status: 'pending',
        invited_at:        new Date(),
      }).onConflictDoNothing()
    }

    revalidatePath(`/platform/tenants/${tenantId}`)
    revalidatePath('/platform')
    return { success: true, data: { userId } }
  } catch (err) {
    console.error('[inviteUserToTenantAsAdmin]', err)
    return { success: false, error: 'Error inesperado al invitar el usuario' }
  }
}

// ── uploadTenantLogo ──────────────────────────────────────────

const ALLOWED_LOGO_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'] as const
const LOGO_EXT_MAP: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png':     'png',
  'image/jpeg':    'jpg',
  'image/webp':    'webp',
}

export async function uploadTenantLogo(
  tenantId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { success: false, error: 'No se recibió ningún archivo.' }
  if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    return { success: false, error: 'Formato no soportado. Usá SVG, PNG, JPG o WebP.' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'El archivo no puede superar 5 MB.' }
  }

  const ext  = LOGO_EXT_MAP[file.type] ?? 'png'
  const path = `${tenantId}/logo.${ext}`
  const adminClient = createAdminClient()

  // Borrar logos anteriores con otras extensiones
  for (const e of Object.values(LOGO_EXT_MAP)) {
    if (e !== ext) {
      await adminClient.storage.from('tenant-logos').remove([`${tenantId}/logo.${e}`])
    }
  }

  const { error: uploadError } = await adminClient.storage
    .from('tenant-logos')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[uploadTenantLogo]', uploadError)
    return { success: false, error: 'No se pudo subir el archivo.' }
  }

  const { data } = adminClient.storage.from('tenant-logos').getPublicUrl(path)
  // Append cache-buster so browsers/CDN don't serve stale versions on re-upload
  const url = `${data.publicUrl}?t=${Date.now()}`

  await dbAdmin
    .update(schema.tenants)
    .set({ logo_url: url })
    .where(eq(schema.tenants.id, tenantId))

  revalidatePath('/', 'layout')
  revalidatePath(`/platform/tenants/${tenantId}`)
  return { success: true, data: { url } }
}

// ── setLogoUrl — guarda una URL directa sin subir archivo ─────
// Útil para imágenes ya alojadas en /public u otro CDN.

export async function setLogoUrl(
  tenantId: string,
  url: string | null,
): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  await dbAdmin
    .update(schema.tenants)
    .set({ logo_url: url || null })
    .where(eq(schema.tenants.id, tenantId))

  revalidatePath(`/platform/tenants/${tenantId}`)
  return { success: true, data: undefined }
}

// ── removeTenantLogo ──────────────────────────────────────────

export async function removeTenantLogo(tenantId: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const adminClient = createAdminClient()
  // Intentar borrar todas las extensiones posibles
  await Promise.all(
    Object.values(LOGO_EXT_MAP).map((ext) =>
      adminClient.storage.from('tenant-logos').remove([`${tenantId}/logo.${ext}`]),
    ),
  )

  await dbAdmin
    .update(schema.tenants)
    .set({ logo_url: null })
    .where(eq(schema.tenants.id, tenantId))

  revalidatePath('/', 'layout')
  revalidatePath(`/platform/tenants/${tenantId}`)
  return { success: true, data: undefined }
}

// ── toggleModule ──────────────────────────────────────────────

export async function toggleModule(
  tenantId:  string,
  moduleKey: string,
  enabled:   boolean,
): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  await dbAdmin
    .insert(schema.tenantModules)
    .values({
      tenant_id:  tenantId,
      module_key: moduleKey as typeof schema.tenantModules.$inferInsert['module_key'],
      enabled,
    })
    .onConflictDoUpdate({
      target:     [schema.tenantModules.tenant_id, schema.tenantModules.module_key],
      set:        { enabled, updated_at: new Date() },
    })

  revalidatePath(`/platform/tenants/${tenantId}`)
  return { success: true, data: undefined }
}

// ── deactivateMemberAdmin ─────────────────────────────────────

export async function deactivateMemberAdmin(
  tenantId: string,
  userId:   string,
): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  await dbAdmin
    .update(schema.tenantMembers)
    .set({ activo: false })
    .where(and(
      eq(schema.tenantMembers.tenant_id, tenantId),
      eq(schema.tenantMembers.user_id, userId),
    ))

  revalidatePath(`/platform/tenants/${tenantId}`)
  return { success: true, data: undefined }
}

// ── fetchAllUsers ─────────────────────────────────────────────
// Lista global de usuarios para el panel de platform admin.

export async function fetchAllUsers(): Promise<UserRow[]> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return []

  const INVITE_EXPIRY_HOURS = 24

  const authListWithTimeout = Promise.race([
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
    new Promise<{ data: { users: [] }; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: { users: [] }, error: new Error('timeout') }), 3000),
    ),
  ])

  const [rows, authListResult] = await Promise.all([
    dbAdmin
      .select({
        id:                schema.usuarios.id,
        email:             schema.usuarios.email,
        nombre:            schema.usuarios.nombre,
        rol:               schema.usuarios.rol,
        is_platform_admin: schema.usuarios.is_platform_admin,
        activo:            schema.usuarios.activo,
        tenant_id:         schema.tenantMembers.tenant_id,
        tenant_nombre:     schema.tenants.nombre,
        concesionaria:     schema.tenants.concesionaria,
        member_rol:        schema.tenantMembers.rol,
        invitation_status: schema.tenantMembers.invitation_status,
        invited_at:        schema.tenantMembers.invited_at,
      })
      .from(schema.usuarios)
      .leftJoin(schema.tenantMembers, eq(schema.tenantMembers.user_id, schema.usuarios.id))
      .leftJoin(schema.tenants, eq(schema.tenants.id, schema.tenantMembers.tenant_id))
      .orderBy(schema.usuarios.nombre),
    authListWithTimeout,
  ])

  const bannedMap = new Map<string, boolean>()
  if (!authListResult.error && authListResult.data?.users) {
    for (const u of authListResult.data.users) {
      const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date()
      bannedMap.set(u.id, isBanned)
    }
  } else if (authListResult.error) {
    console.warn('[fetchAllUsers] auth.listUsers slow/failed:', authListResult.error.message)
  }

  function computeStatus(r: {
    activo:            boolean
    invitation_status: string | null
    invited_at:        Date | null
    isBanned:          boolean
  }): PlatformUserStatus {
    if (r.isBanned) return 'baneado'
    if (r.invitation_status === 'pending') {
      if (!r.invited_at) return 'pendiente'
      const expiresAt = new Date(r.invited_at)
      expiresAt.setHours(expiresAt.getHours() + INVITE_EXPIRY_HOURS)
      return expiresAt < new Date() ? 'expirado' : 'pendiente'
    }
    if (!r.activo) return 'inactivo'
    return 'activo'
  }

  return rows.map((r) => {
    const isBanned = bannedMap.get(r.id) ?? false
    return {
      id:                r.id,
      email:             r.email,
      nombre:            r.nombre,
      rol:               r.rol,
      is_platform_admin: r.is_platform_admin,
      activo:            r.activo,
      isBanned,
      status: computeStatus({
        activo:            r.activo,
        invitation_status: r.invitation_status ?? null,
        invited_at:        r.invited_at        ?? null,
        isBanned,
      }),
      tenant_id:         r.tenant_id         ?? null,
      tenant_nombre:     r.tenant_nombre      ?? null,
      concesionaria:     r.concesionaria      ?? null,
      member_rol:        r.member_rol         ?? null,
      invitation_status: r.invitation_status  ?? null,
      invited_at:        r.invited_at         ?? null,
    }
  })
}

// ── fetchTenantOptions ────────────────────────────────────────
// Para el selector de concesionaria en el dialog de invitar usuario.

export async function fetchTenantOptions(): Promise<{ id: string; nombre: string; concesionaria: string }[]> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return []

  return dbAdmin
    .select({
      id:            schema.tenants.id,
      nombre:        schema.tenants.nombre,
      concesionaria: schema.tenants.concesionaria,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.activo, true))
    .orderBy(schema.tenants.nombre)
}

// ── changeUserRole ────────────────────────────────────────────

export async function changeUserRole(
  userId:   string,
  tenantId: string,
  newRol:   AppRole,
): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const [target] = await dbAdmin
    .select({ is_platform_admin: schema.usuarios.is_platform_admin })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, userId))
    .limit(1)

  if (target?.is_platform_admin) {
    return { success: false, error: 'No se puede cambiar el rol de un Platform Admin.' }
  }

  await Promise.all([
    dbAdmin
      .update(schema.usuarios)
      .set({ rol: newRol })
      .where(eq(schema.usuarios.id, userId)),
    dbAdmin
      .update(schema.tenantMembers)
      .set({ rol: newRol })
      .where(and(
        eq(schema.tenantMembers.user_id, userId),
        eq(schema.tenantMembers.tenant_id, tenantId),
      )),
  ])

  revalidatePath('/platform/users')
  return { success: true, data: undefined }
}

// ── deactivateUserAdmin ───────────────────────────────────────

export async function deactivateUserAdmin(
  userId:   string,
  tenantId: string,
): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const adminClient = createAdminClient()
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: '87600h',
  })
  if (authError) {
    console.error('[deactivateUserAdmin]', authError)
    return { success: false, error: 'No se pudo desactivar el acceso.' }
  }

  await Promise.all([
    dbAdmin
      .update(schema.usuarios)
      .set({ activo: false })
      .where(eq(schema.usuarios.id, userId)),
    dbAdmin
      .update(schema.tenantMembers)
      .set({ activo: false })
      .where(and(
        eq(schema.tenantMembers.user_id, userId),
        eq(schema.tenantMembers.tenant_id, tenantId),
      )),
  ])

  revalidatePath('/platform/users')
  return { success: true, data: undefined }
}

// ── reactivateUserAdmin ───────────────────────────────────────

export async function reactivateUserAdmin(
  userId:   string,
  tenantId: string,
): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const adminClient = createAdminClient()
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (authError) {
    console.error('[reactivateUserAdmin]', authError)
    return { success: false, error: 'No se pudo reactivar al usuario.' }
  }

  await Promise.all([
    dbAdmin
      .update(schema.usuarios)
      .set({ activo: true })
      .where(eq(schema.usuarios.id, userId)),
    dbAdmin
      .update(schema.tenantMembers)
      .set({ activo: true })
      .where(and(
        eq(schema.tenantMembers.user_id, userId),
        eq(schema.tenantMembers.tenant_id, tenantId),
      )),
  ])

  revalidatePath('/platform/users')
  return { success: true, data: undefined }
}

// ── resetUserPasswordAdmin ────────────────────────────────────

export async function resetUserPasswordAdmin(userEmail: string): Promise<ActionResult<void>> {
  const user = await getCurrentUser()
  if (!user?.is_platform_admin) return { success: false, error: 'Sin permisos' }

  const adminClient = createAdminClient()
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await adminClient.auth.resetPasswordForEmail(userEmail, {
    redirectTo: `${siteUrl}/auth/confirm?next=/update-password%3Fmode%3Drecovery`,
  })

  if (error) {
    console.error('[resetUserPasswordAdmin]', error)
    return { success: false, error: 'No se pudo enviar el email de recuperación.' }
  }

  return { success: true, data: undefined }
}
