'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, inArray, gte, count } from 'drizzle-orm'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit/log'
import { startOfTodayAR } from '@/lib/utils'
import { releaseMemberWorkload, revokeAuthIfOrphaned, restoreAuthAccess } from '@/lib/members/offboarding'
import type { ActionResult } from './auth'
import type { AppRole } from '@/lib/auth/get-current-user'

// Límite diario que impone el producto (independiente del rate-limit de Supabase).
const DUENO_DAILY_LIMIT = 4

// Roles que el dueño puede gestionar/asignar (no puede tocar dueño/platform_admin).
const MANAGEABLE_ROLES: AppRole[] = ['gerente', 'supervisor', 'vendedor']

/** Cuenta las acciones de un actor en el día (calendario AR) para rate-limits. */
async function countActorActionsToday(
  tenantId: string,
  actorId:  string,
  action:   string,
): Promise<number> {
  const [row] = await dbAdmin
    .select({ n: count() })
    .from(schema.auditLogs)
    .where(and(
      eq(schema.auditLogs.tenant_id, tenantId),
      eq(schema.auditLogs.actor_id, actorId),
      eq(schema.auditLogs.action, action),
      gte(schema.auditLogs.created_at, startOfTodayAR()),
    ))
  return Number(row?.n ?? 0)
}

/**
 * Carga un miembro del tenant verificando que el dueño pueda gestionarlo:
 * existe en el tenant, no es el propio dueño, y su rol es gestionable
 * (no otro dueño ni platform_admin). Devuelve el email del usuario o un error.
 */
async function loadManageableMember(
  tenantId:     string,
  callerId:     string,
  targetUserId: string,
): Promise<{ email: string; rol: AppRole } | { error: string }> {
  if (targetUserId === callerId) return { error: 'No podés realizar esta acción sobre vos mismo' }

  const [row] = await dbAdmin
    .select({
      rol:   schema.tenantMembers.rol,
      email: schema.usuarios.email,
      isPA:  schema.usuarios.is_platform_admin,
    })
    .from(schema.tenantMembers)
    .leftJoin(schema.usuarios, eq(schema.tenantMembers.user_id, schema.usuarios.id))
    .where(and(
      eq(schema.tenantMembers.tenant_id, tenantId),
      eq(schema.tenantMembers.user_id, targetUserId),
    ))
    .limit(1)

  if (!row) return { error: 'El usuario no es miembro de tu empresa' }
  if (row.isPA || row.rol === 'dueno') {
    return { error: 'No podés gestionar a este usuario' }
  }
  return { email: row.email ?? '', rol: row.rol as AppRole }
}

// ── Guard ─────────────────────────────────────────────────────

async function requireTenant() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) throw new Error('No autenticado')
  return { user, tenantId }
}

// ── listTenantMembers ─────────────────────────────────────────

export async function listTenantMembers() {
  const { user, tenantId } = await requireTenant()

  // Solo supervisor+ puede listar miembros del tenant.
  if (user.rol === 'vendedor') return []

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

  if (!['dueno'].includes(user.rol)) {
    return { success: false, error: 'Solo el dueño puede invitar usuarios' }
  }

  const email = input.email.toLowerCase().trim()
  if (!email.includes('@')) return { success: false, error: 'Email inválido' }
  if (!input.nombre.trim())  return { success: false, error: 'El nombre es requerido' }

  // Límite diario propio del producto: 4 invitaciones por día por dueño.
  const invitesHoy = await countActorActionsToday(tenantId, user.id, 'user.invite')
  if (invitesHoy >= DUENO_DAILY_LIMIT) {
    return {
      success: false,
      error: `Llegaste al límite de ${DUENO_DAILY_LIMIT} invitaciones por día. Probá de nuevo mañana.`,
    }
  }

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
        return { success: false, error: 'Este usuario ya es miembro de la empresa' }
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

  if (!['dueno'].includes(user.rol)) {
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

  // Liberar su trabajo (leads → "Sin asignar", citas/traspasos cancelados) y,
  // si no le queda ninguna membresía activa, revocarle el acceso.
  const released = await releaseMemberWorkload(tenantId, memberId, user.id)
  await revokeAuthIfOrphaned(memberId)

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'user.deactivate',
    entity:         'user',
    entityId:       memberId,
    meta: {
      leads_liberados:     released.leads,
      citas_canceladas:    released.appointments,
      traspasos_cancelados: released.transfers,
    },
    visibleToDueno: true,
  })

  revalidatePath('/equipo')
  revalidatePath('/leads')
  return { success: true, data: undefined }
}

// ── reactivateMember ──────────────────────────────────────────

export async function reactivateMember(memberId: string): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()
  if (!['dueno'].includes(user.rol)) {
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

  // Devolverle el acceso (quita baneo + usuarios.activo=true) por si al darlo de
  // baja había quedado huérfano y se le revocó el login.
  await restoreAuthAccess(memberId)

  revalidatePath('/equipo')
  return { success: true, data: undefined }
}

// ── changeMemberRole ──────────────────────────────────────────
// El dueño cambia el rol de un miembro de su empresa (gerente/supervisor/
// vendedor). Actualiza usuarios.rol (autoritativo) y tenant_members.rol.

export async function changeMemberRole(
  memberUserId: string,
  newRol:       AppRole,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()
  if (user.rol !== 'dueno') return { success: false, error: 'Solo el dueño puede cambiar roles' }
  if (!MANAGEABLE_ROLES.includes(newRol)) return { success: false, error: 'Rol inválido' }

  const target = await loadManageableMember(tenantId, user.id, memberUserId)
  if ('error' in target) return { success: false, error: target.error }
  if (target.rol === newRol) return { success: true, data: undefined }

  await Promise.all([
    dbAdmin.update(schema.usuarios)
      .set({ rol: newRol })
      .where(eq(schema.usuarios.id, memberUserId)),
    dbAdmin.update(schema.tenantMembers)
      .set({ rol: newRol })
      .where(and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.user_id, memberUserId),
      )),
  ])

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'user.role_change',
    entity:         'user',
    entityId:       memberUserId,
    meta:           { from: target.rol, to: newRol },
    visibleToDueno: true,
  })

  revalidatePath('/configuracion')
  revalidatePath('/equipo')
  return { success: true, data: undefined }
}

// ── resetMemberPassword ───────────────────────────────────────
// El dueño manda un email de "restablecer contraseña" a un miembro.
// Límite del producto: 4 por día por dueño.

export async function resetMemberPassword(
  memberUserId: string,
): Promise<ActionResult<void>> {
  const { user, tenantId } = await requireTenant()
  if (user.rol !== 'dueno') return { success: false, error: 'Solo el dueño puede enviar restablecimientos' }

  const target = await loadManageableMember(tenantId, user.id, memberUserId)
  if ('error' in target) return { success: false, error: target.error }
  if (!target.email) return { success: false, error: 'El usuario no tiene email cargado' }

  const resetsHoy = await countActorActionsToday(tenantId, user.id, 'user.password_reset')
  if (resetsHoy >= DUENO_DAILY_LIMIT) {
    return {
      success: false,
      error: `Llegaste al límite de ${DUENO_DAILY_LIMIT} restablecimientos por día. Probá de nuevo mañana.`,
    }
  }

  const adminClient = createAdminClient()
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { error } = await adminClient.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/update-password`,
  })
  if (error) {
    console.error('[resetMemberPassword]', error)
    return { success: false, error: 'No se pudo enviar el email por el momento. Puede ser un límite de envíos; probá más tarde.' }
  }

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'user.password_reset',
    entity:         'user',
    entityId:       memberUserId,
    meta:           { email: target.email },
    visibleToDueno: true,
  })

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
// Vendedores activos VISIBLES según el scope del que llama. Alimenta los
// filtros por vendedor (all-leads, citas) y el selector de reasignación
// (rescate). Respeta la jerarquía de equipos:
//   dueño/admin → todos los vendedores del tenant
//   gerente     → solo los de sus equipos
//   supervisor  → solo los de su equipo
//   vendedor    → solo él mismo (no lista a otros)

export async function getVendedoresDelTenant() {
  const { user, tenantId } = await requireTenant()
  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)

  const where = [
    eq(schema.tenantMembers.tenant_id, tenantId),
    eq(schema.tenantMembers.rol, 'vendedor'),
    eq(schema.tenantMembers.activo, true),
  ]

  if (scope.type === 'team') {
    where.push(eq(schema.tenantMembers.equipo_id, scope.equipoId))
  } else if (scope.type === 'teams') {
    if (scope.equipoIds.length === 0) return []
    where.push(inArray(schema.tenantMembers.equipo_id, scope.equipoIds))
  } else if (scope.type === 'self') {
    where.push(eq(schema.tenantMembers.user_id, user.id))
  } else if (scope.type === 'none') {
    return []
  }
  // scope.type === 'all' → sin filtro de equipo (todo el tenant)

  return dbAdmin
    .select({
      user_id: schema.tenantMembers.user_id,
      nombre:  schema.usuarios.nombre,
      alias:   schema.usuarios.alias,
      equipo_id: schema.tenantMembers.equipo_id,
    })
    .from(schema.tenantMembers)
    .leftJoin(schema.usuarios, eq(schema.tenantMembers.user_id, schema.usuarios.id))
    .where(and(...where))
    .orderBy(schema.usuarios.nombre)
}

// ── getVendedoresParaTraspaso ─────────────────────────────────
// Vendedores a los que el usuario actual puede TRASPASAR un lead.
// A diferencia de getVendedoresDelTenant, un vendedor ve a sus COMPAÑEROS de
// equipo (no solo a sí mismo): el traspaso es justamente hacia otro vendedor.
//   vendedor   → compañeros de su equipo (sin equipo → ninguno)
//   supervisor → vendedores de su equipo
//   gerente    → vendedores de sus equipos
//   dueño/admin → todos

export async function getVendedoresParaTraspaso() {
  const { user, tenantId } = await requireTenant()
  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)

  const where = [
    eq(schema.tenantMembers.tenant_id, tenantId),
    eq(schema.tenantMembers.rol, 'vendedor'),
    eq(schema.tenantMembers.activo, true),
  ]

  if (scope.type === 'team') {
    where.push(eq(schema.tenantMembers.equipo_id, scope.equipoId))
  } else if (scope.type === 'teams') {
    if (scope.equipoIds.length === 0) return []
    where.push(inArray(schema.tenantMembers.equipo_id, scope.equipoIds))
  } else if (scope.type === 'self') {
    // vendedor → sus compañeros de equipo. Sin equipo, no hay con quién compartir.
    if (!scope.equipoId) return []
    where.push(eq(schema.tenantMembers.equipo_id, scope.equipoId))
  } else if (scope.type === 'none') {
    return []
  }
  // scope.type === 'all' → sin filtro de equipo (todo el tenant)

  return dbAdmin
    .select({
      user_id:   schema.tenantMembers.user_id,
      nombre:    schema.usuarios.nombre,
      alias:     schema.usuarios.alias,
      equipo_id: schema.tenantMembers.equipo_id,
    })
    .from(schema.tenantMembers)
    .leftJoin(schema.usuarios, eq(schema.tenantMembers.user_id, schema.usuarios.id))
    .where(and(...where))
    .orderBy(schema.usuarios.nombre)
}

// ── getAsignablesParaLead ─────────────────────────────────────
// Opciones de asignación para el alta de lead, según el scope del usuario:
//  - dueño/admin → todos los equipos del tenant + sus vendedores
//  - gerente     → solo sus equipos + sus vendedores
//  - supervisor  → solo su equipo + sus vendedores
//  - vendedor    → ninguno (se auto-asigna)
// Permite que un gerente/dueño asigne a un equipo (sin vendedor) para que el
// supervisor lo derive luego, o directo a un vendedor.

export async function getAsignablesParaLead(): Promise<{
  scope: 'all' | 'teams' | 'team' | 'self' | 'none'
  equipos: {
    id:     string
    nombre: string
    vendedores: { user_id: string; nombre: string | null; alias: string | null }[]
  }[]
}> {
  const { user, tenantId } = await requireTenant()
  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)

  if (scope.type === 'self' || scope.type === 'none') {
    return { scope: scope.type, equipos: [] }
  }

  // Equipos en alcance
  const teamWhere = [
    eq(schema.equipos.tenant_id, tenantId),
    eq(schema.equipos.activo, true),
  ]
  if (scope.type === 'team')  teamWhere.push(eq(schema.equipos.id, scope.equipoId))
  if (scope.type === 'teams') teamWhere.push(inArray(schema.equipos.id, scope.equipoIds))

  const teamRows = await dbAdmin
    .select({ id: schema.equipos.id, nombre: schema.equipos.nombre })
    .from(schema.equipos)
    .where(and(...teamWhere))
    .orderBy(schema.equipos.nombre)

  // Vendedores activos del tenant (los filtramos por equipo abajo)
  const vendedores = await dbAdmin
    .select({
      user_id:   schema.tenantMembers.user_id,
      equipo_id: schema.tenantMembers.equipo_id,
      nombre:    schema.usuarios.nombre,
      alias:     schema.usuarios.alias,
    })
    .from(schema.tenantMembers)
    .leftJoin(schema.usuarios, eq(schema.tenantMembers.user_id, schema.usuarios.id))
    .where(and(
      eq(schema.tenantMembers.tenant_id, tenantId),
      eq(schema.tenantMembers.rol, 'vendedor'),
      eq(schema.tenantMembers.activo, true),
    ))
    .orderBy(schema.usuarios.nombre)

  return {
    scope: scope.type,
    equipos: teamRows.map((t) => ({
      id:     t.id,
      nombre: t.nombre,
      vendedores: vendedores
        .filter((v) => v.equipo_id === t.id)
        .map((v) => ({ user_id: v.user_id, nombre: v.nombre, alias: v.alias })),
    })),
  }
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
