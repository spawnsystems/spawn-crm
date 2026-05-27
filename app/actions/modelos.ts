'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { modeloSchema } from '@/lib/schemas/configuracion'
import { logAudit } from '@/lib/audit/log'
import type { ActionResult } from './auth'

// ── Guard ─────────────────────────────────────────────────────

async function requireDueno() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return { error: 'No autenticado' as const, user: null, tenantId: null }
  if (!['dueno'].includes(user.rol)) {
    return { error: 'Solo el dueño puede gestionar modelos' as const, user: null, tenantId: null }
  }
  return { error: null, user, tenantId }
}

// ── getModelosVehiculo ────────────────────────────────────────
// Todos los modelos del tenant (activos e inactivos) — para la UI de gestión.
// Para el selector de leads, los pages filtran activo=true.

export async function getModelosVehiculo() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return []

  return dbAdmin
    .select({
      id:          schema.modelosVehiculo.id,
      nombre:      schema.modelosVehiculo.nombre,
      motor:       schema.modelosVehiculo.motor,
      transmision: schema.modelosVehiculo.transmision,
      consumo:     schema.modelosVehiculo.consumo,
      precio:      schema.modelosVehiculo.precio,
      stock:       schema.modelosVehiculo.stock,
      activo:      schema.modelosVehiculo.activo,
    })
    .from(schema.modelosVehiculo)
    .where(eq(schema.modelosVehiculo.tenant_id, tenantId))
    .orderBy(schema.modelosVehiculo.nombre)
}

// Solo nombres de modelos activos — para el selector en NewLeadDialog.
export async function getActiveModelNames(): Promise<string[]> {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return []

  const rows = await dbAdmin
    .select({ nombre: schema.modelosVehiculo.nombre })
    .from(schema.modelosVehiculo)
    .where(
      and(
        eq(schema.modelosVehiculo.tenant_id, tenantId),
        eq(schema.modelosVehiculo.activo, true),
      ),
    )
    .orderBy(schema.modelosVehiculo.nombre)

  return rows.map((r) => r.nombre)
}

// ── createModelo ──────────────────────────────────────────────

export async function createModelo(input: unknown): Promise<ActionResult<{ id: string }>> {
  const { error, user, tenantId } = await requireDueno()
  if (error || !user || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  const parsed = modeloSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const data = parsed.data

  const [row] = await dbAdmin
    .insert(schema.modelosVehiculo)
    .values({
      tenant_id:   tenantId,
      nombre:      data.nombre.trim(),
      motor:       data.motor?.trim()       ?? null,
      transmision: data.transmision?.trim() ?? null,
      consumo:     data.consumo?.trim()     ?? null,
      precio:      data.precio != null ? String(data.precio) : null,
      stock:       data.stock ?? 0,
    })
    .returning({ id: schema.modelosVehiculo.id })

  void logAudit({
    tenantId, actorId: user.id,
    action: 'modelo.create', entity: 'modelo', entityId: row.id,
    meta: { nombre: data.nombre },
    visibleToDueno: true,
  })

  revalidatePath('/configuracion')
  return { success: true, data: { id: row.id } }
}

// ── updateModelo ──────────────────────────────────────────────

export async function updateModelo(
  id:    string,
  input: unknown,
): Promise<ActionResult<void>> {
  const { error, user, tenantId } = await requireDueno()
  if (error || !user || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  const parsed = modeloSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const data = parsed.data

  await dbAdmin
    .update(schema.modelosVehiculo)
    .set({
      nombre:      data.nombre.trim(),
      motor:       data.motor?.trim()       ?? null,
      transmision: data.transmision?.trim() ?? null,
      consumo:     data.consumo?.trim()     ?? null,
      precio:      data.precio != null ? String(data.precio) : null,
      stock:       data.stock ?? 0,
    })
    .where(
      and(
        eq(schema.modelosVehiculo.id, id),
        eq(schema.modelosVehiculo.tenant_id, tenantId),
      ),
    )

  void logAudit({
    tenantId, actorId: user.id,
    action: 'modelo.update', entity: 'modelo', entityId: id,
    meta: { nombre: data.nombre },
    visibleToDueno: true,
  })

  revalidatePath('/configuracion')
  return { success: true, data: undefined }
}

// ── toggleModeloActivo ────────────────────────────────────────

export async function toggleModeloActivo(id: string): Promise<ActionResult<void>> {
  const { error, user, tenantId } = await requireDueno()
  if (error || !user || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  const [row] = await dbAdmin
    .select({ activo: schema.modelosVehiculo.activo })
    .from(schema.modelosVehiculo)
    .where(
      and(
        eq(schema.modelosVehiculo.id, id),
        eq(schema.modelosVehiculo.tenant_id, tenantId),
      ),
    )
    .limit(1)

  if (!row) return { success: false, error: 'Modelo no encontrado' }

  await dbAdmin
    .update(schema.modelosVehiculo)
    .set({ activo: !row.activo })
    .where(
      and(
        eq(schema.modelosVehiculo.id, id),
        eq(schema.modelosVehiculo.tenant_id, tenantId),
      ),
    )

  void logAudit({
    tenantId, actorId: user.id,
    action: row.activo ? 'modelo.delete' : 'modelo.update',
    entity: 'modelo', entityId: id,
    meta: { activo: !row.activo },
    visibleToDueno: true,
  })

  revalidatePath('/configuracion')
  return { success: true, data: undefined }
}
