'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit/log'
import type { ActionResult } from './auth'
import type { AppRole } from '@/lib/auth/get-current-user'

// ── Guard ─────────────────────────────────────────────────────

async function requireTenant() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) throw new Error('No autenticado')
  return { user, tenantId }
}

// ── listTenantMembers ─────────────────────────────────────────

export async function listTenantMembers() {
  const { tenantId } = await requireTenant()

  return dbAdmin
    .select({
      user_id:           schema.tenantMembers.user_id,
      rol:               schema.tenantMembers.rol,
      equipo_id:         schema.tenantMembers.equipo_id,
      activo:            schema.tenantMembers.activo,
      invitation_status: schema.tenantMembers.invitation_status,
      nombre:            schema.usuarios.nombre,
      alias:             schema.usuarios.alias,
      email:             schema.usuarios.email,
    })
    .from(schema.tenantMembers)
    .leftJoin(schema.usuarios, eq(schema.tenantMembers.user_id, schema.usuarios.id))
    .where(eq(schema.tenantMembers.tenant_id, tenantId))
    .orderBy(schema.usuarios.nombre)
}

// ── inviteUserToTenant ────────────────────────────────────────

export async function inviteUserToTenant(input: {
  email:    string
  nombre:   string
  rol:      AppRole
  equipoId?: string | null
}): Promise<ActionResult<{ userId: string }>> {
  const { user, tenantId } = await requireTenant()

  if (!['platform_admin', 'dueno'].includes(user.rol)) {
    return { success: false, error: 'Solo el dueño puede invitar usuarios' }
  }

  const email = input.email.toLowerCase().trim()
  if (!email.includes('@')) return { success: false, error: 'Email inválido' }
  if (!input.nombre.trim())  return { success: false, error: 'El nombre es requerido' }

  const adminClient = createAdminClient()
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  try {
    // ¿Ya existe en usuarios?
    const existing = await dbAdmin
      .select({ id: schema.usuarios.id })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.email, email))
      .limit(1)

    let userId: string

    if (existing[0]) {
      userId = existing[0].id

      // ¿Ya es miembro?
      const alreadyMember = await dbAdmin
        .select({ id: schema.tenantMembers.id })
        .from(schema.tenantMembers)
        .where(
          and(
            eq(schema.tenantMembers.tenant_id, tenantId),
            eq(schema.tenantMembers.user_id, userId),
          ),
        )
        .limit(1)
      if (alreadyMember[0]) {
        return { success: false, error: 'Este usuario ya es miembro del tenant' }
      }

      // Agregar directamente como aceptado
      await dbAdmin.insert(schema.tenantMembers).values({
        tenant_id:         tenantId,
        user_id:           userId,
        rol:               input.rol,
        equipo_id:         input.equipoId ?? null,
        activo:            true,
        invitation_status: 'accepted',
      })
    } else {
      // Usuario nuevo → invitar por Supabase Auth
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/confirm`,
        data: {
          nombre: input.nombre.trim(),
          rol:    input.rol,
        },
      })

      if (error) {
        console.error('[inviteUserToTenant]', error)
        return { success: false, error: mapInviteError(error.message) }
      }

      userId = data.user.id

      // El trigger handle_new_auth_user ya crea la fila en usuarios.
      // Actualizamos con los datos correctos por si acaso.
      await dbAdmin
        .update(schema.usuarios)
        .set({ nombre: input.nombre.trim(), rol: input.rol })
        .where(eq(schema.usuarios.id, userId))

      // Agregar como miembro pendiente
      await dbAdmin.insert(schema.tenantMembers).values({
        tenant_id:         tenantId,
        user_id:           userId,
        rol:               input.rol,
        equipo_id:         input.equipoId ?? null,
        activo:            false,
        invitation_status: 'pending',
        invited_at:        new Date(),
      }).onConflictDoNothing()
    }

    void logAudit({
      tenantId,
      actorId:        user.id,
      action:         'user.invite',
      entity:         'user',
      entityId:       userId,
      meta:           { email, rol: input.rol, nombre: input.nombre },
      visibleToDueno: true,
    })

    revalidatePath('/equipo')
    revalidatePath('/platform')
    return { success: true, data: { userId } }
  } catch (err) {
    console.error('[inviteUserToTenant] Unexpected:', err)
    return { success: false, error: 'Error inesperado al invitar el usuario' }
  }
}

// ── deactivateMember ─────────────────────────────────────────

export async function deactivateMember(memberId: string): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()

  if (!['platform_admin', 'dueno'].includes(user.rol)) {
    return { success: false, error: 'Sin permisos' }
  }
  if (memberId === user.id) {
    return { success: false, error: 'No podés darte de baja a vos mismo' }
  }

  await dbAdmin
    .update(schema.tenantMembers)
    .set({ activo: false })
    .where(
      and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.user_id, memberId),
      ),
    )

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'user.deactivate',
    entity:         'user',
    entityId:       memberId,
    visibleToDueno: true,
  })

  revalidatePath('/equipo')
  return { success: true, data: undefined }
}

// ── reactivateMember ──────────────────────────────────────────

export async function reactivateMember(memberId: string): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()
  if (!['platform_admin', 'dueno'].includes(user.rol)) {
    return { success: false, error: 'Sin permisos' }
  }

  await dbAdmin
    .update(schema.tenantMembers)
    .set({ activo: true })
    .where(
      and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.user_id, memberId),
      ),
    )

  revalidatePath('/equipo')
  return { success: true, data: undefined }
}

// ── updateMyProfile ───────────────────────────────────────────

export async function updateMyProfile(input: {
  nombre?: string
  alias?:  string | null
}): Promise<ActionResult<void>> {
  const { user } = await requireTenant()

  await dbAdmin
    .update(schema.usuarios)
    .set({
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.alias  !== undefined ? { alias:  input.alias?.trim() || null } : {}),
    })
    .where(eq(schema.usuarios.id, user.id))

  revalidatePath('/', 'layout')
  return { success: true, data: undefined }
}

// ── getVendedoresDelTenant ────────────────────────────────────
// Lista vendedores activos para el selector de asignación en nuevo lead

export async function getVendedoresDelTenant() {
  const { tenantId } = await requireTenant()

  return dbAdmin
    .select({
      user_id: schema.tenantMembers.user_id,
      nombre:  schema.usuarios.nombre,
      alias:   schema.usuarios.alias,
      equipo_id: schema.tenantMembers.equipo_id,
    })
    .from(schema.tenantMembers)
    .leftJoin(schema.usuarios, eq(schema.tenantMembers.user_id, schema.usuarios.id))
    .where(
      and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.rol, 'vendedor'),
        eq(schema.tenantMembers.activo, true),
      ),
    )
    .orderBy(schema.usuarios.nombre)
}

// ── Helpers ───────────────────────────────────────────────────

function mapInviteError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('already been registered') || msg.includes('already exists')) {
    return 'Este email ya tiene una cuenta en la plataforma'
  }
  if (msg.includes('invalid email')) {
    return 'El formato del email no es válido'
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Límite de invitaciones alcanzado. Intentá en unos minutos.'
  }
  return `Error al invitar: ${message}`
}
