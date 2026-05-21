'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import type { ActionResult } from './auth'

// ── Guard ─────────────────────────────────────────────────────

async function requireDueno() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return { error: 'No autenticado' as const, user: null, tenantId: null }
  if (!['platform_admin', 'dueno', 'gerente'].includes(user.rol)) {
    return { error: 'Sin permisos' as const, user: null, tenantId: null }
  }
  return { error: null, user, tenantId }
}

// ── createEquipo ──────────────────────────────────────────────

export async function createEquipo(input: {
  nombre:       string
  gerente_id?:  string | null
  supervisor_id?: string | null
}): Promise<ActionResult<{ id: string }>> {
  const { error, user, tenantId } = await requireDueno()
  if (error || !user || !tenantId) return { success: false, error: error ?? 'Sin permisos' }
  if (!input.nombre?.trim()) return { success: false, error: 'El nombre es requerido' }

  const [row] = await dbAdmin
    .insert(schema.equipos)
    .values({
      tenant_id:     tenantId,
      nombre:        input.nombre.trim(),
      gerente_id:    input.gerente_id    ?? null,
      supervisor_id: input.supervisor_id ?? null,
      activo:        true,
    })
    .returning({ id: schema.equipos.id })

  // Si hay supervisor, actualizar su equipo_id en tenant_members
  if (input.supervisor_id) {
    await dbAdmin
      .update(schema.tenantMembers)
      .set({ equipo_id: row.id })
      .where(
        and(
          eq(schema.tenantMembers.tenant_id, tenantId),
          eq(schema.tenantMembers.user_id, input.supervisor_id),
        ),
      )
  }

  revalidatePath('/equipo')
  revalidatePath('/dashboard')
  return { success: true, data: { id: row.id } }
}

// ── updateEquipo ──────────────────────────────────────────────

export async function updateEquipo(
  equipoId: string,
  input: {
    nombre?:       string
    gerente_id?:   string | null
    supervisor_id?: string | null
    activo?:       boolean
  },
): Promise<ActionResult<void>> {
  const { error, tenantId } = await requireDueno()
  if (error || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  await dbAdmin
    .update(schema.equipos)
    .set({
      ...(input.nombre        !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.gerente_id    !== undefined ? { gerente_id: input.gerente_id }    : {}),
      ...(input.supervisor_id !== undefined ? { supervisor_id: input.supervisor_id } : {}),
      ...(input.activo        !== undefined ? { activo: input.activo }             : {}),
    })
    .where(
      and(
        eq(schema.equipos.id, equipoId),
        eq(schema.equipos.tenant_id, tenantId),
      ),
    )

  revalidatePath('/equipo')
  return { success: true, data: undefined }
}

// ── addMemberToEquipo ─────────────────────────────────────────

export async function addMemberToEquipo(
  userId:   string,
  equipoId: string,
): Promise<ActionResult<void>> {
  const { error, tenantId } = await requireDueno()
  if (error || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  // Verificar que el equipo pertenece al tenant
  const equipo = await dbAdmin
    .select({ id: schema.equipos.id })
    .from(schema.equipos)
    .where(
      and(
        eq(schema.equipos.id, equipoId),
        eq(schema.equipos.tenant_id, tenantId),
      ),
    )
    .limit(1)
  if (!equipo[0]) return { success: false, error: 'Equipo no encontrado' }

  await dbAdmin
    .update(schema.tenantMembers)
    .set({ equipo_id: equipoId })
    .where(
      and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.user_id, userId),
      ),
    )

  // Actualizar también los leads activos del vendedor
  await dbAdmin
    .update(schema.leads)
    .set({ equipo_id: equipoId })
    .where(
      and(
        eq(schema.leads.tenant_id, tenantId),
        eq(schema.leads.assigned_to, userId),
      ),
    )

  revalidatePath('/equipo')
  return { success: true, data: undefined }
}

// ── removeMemberFromEquipo ────────────────────────────────────

export async function removeMemberFromEquipo(
  userId: string,
): Promise<ActionResult<void>> {
  const { error, tenantId } = await requireDueno()
  if (error || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  await dbAdmin
    .update(schema.tenantMembers)
    .set({ equipo_id: null })
    .where(
      and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.user_id, userId),
      ),
    )

  revalidatePath('/equipo')
  return { success: true, data: undefined }
}

// ── getEquipos ────────────────────────────────────────────────

export async function getEquipos() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return []

  return dbAdmin
    .select({
      id:            schema.equipos.id,
      nombre:        schema.equipos.nombre,
      activo:        schema.equipos.activo,
      gerente_id:    schema.equipos.gerente_id,
      supervisor_id: schema.equipos.supervisor_id,
    })
    .from(schema.equipos)
    .where(
      and(
        eq(schema.equipos.tenant_id, tenantId),
        eq(schema.equipos.activo, true),
      ),
    )
    .orderBy(schema.equipos.nombre)
}

// ── getEquiposConMiembros ─────────────────────────────────────
// Equipos con nombres de gerente/supervisor + lista de vendedores asignados

export async function getEquiposConMiembros() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return []

  const equipoRows = await dbAdmin
    .select({
      id:            schema.equipos.id,
      nombre:        schema.equipos.nombre,
      activo:        schema.equipos.activo,
      gerente_id:    schema.equipos.gerente_id,
      supervisor_id: schema.equipos.supervisor_id,
    })
    .from(schema.equipos)
    .where(
      and(
        eq(schema.equipos.tenant_id, tenantId),
        eq(schema.equipos.activo, true),
      ),
    )
    .orderBy(schema.equipos.nombre)

  if (equipoRows.length === 0) return []

  // Todos los miembros activos del tenant
  const miembros = await dbAdmin
    .select({
      user_id:   schema.tenantMembers.user_id,
      rol:       schema.tenantMembers.rol,
      equipo_id: schema.tenantMembers.equipo_id,
      activo:    schema.tenantMembers.activo,
      nombre:    schema.usuarios.nombre,
      alias:     schema.usuarios.alias,
      email:     schema.usuarios.email,
    })
    .from(schema.tenantMembers)
    .leftJoin(schema.usuarios, eq(schema.tenantMembers.user_id, schema.usuarios.id))
    .where(
      and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.activo, true),
      ),
    )
    .orderBy(schema.usuarios.nombre)

  const byId = new Map(miembros.map((m) => [m.user_id, m]))

  return equipoRows.map((e) => ({
    ...e,
    gerente:    e.gerente_id    ? (byId.get(e.gerente_id)    ?? null) : null,
    supervisor: e.supervisor_id ? (byId.get(e.supervisor_id) ?? null) : null,
    vendedores: miembros.filter((m) => m.equipo_id === e.id && m.rol === 'vendedor'),
  }))
}

// ── getMiembrosDelTenant ──────────────────────────────────────
// Todos los miembros del tenant, incluyendo invitados pendientes.
// Se usa para los selectores de asignación en la gestión de equipos.

export async function getMiembrosDelTenant() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return []

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
    .orderBy(schema.tenantMembers.rol, schema.usuarios.nombre)
}
