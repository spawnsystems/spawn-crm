'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { tenantInfoSchema, slaConfigSchema } from '@/lib/schemas/configuracion'
import { logAudit } from '@/lib/audit/log'
import type { ActionResult } from './auth'

// ── Guard ─────────────────────────────────────────────────────

async function requireDueno() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return { error: 'No autenticado' as const, user: null, tenantId: null }
  if (!['dueno'].includes(user.rol)) {
    return { error: 'Solo el dueño puede editar la concesionaria' as const, user: null, tenantId: null }
  }
  return { error: null, user, tenantId }
}

// ── updateTenantInfo ──────────────────────────────────────────

export async function updateTenantInfo(input: unknown): Promise<ActionResult<void>> {
  const { error, user, tenantId } = await requireDueno()
  if (error || !user || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  const parsed = tenantInfoSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  await dbAdmin
    .update(schema.tenants)
    .set({
      nombre:        parsed.data.nombre.trim(),
      concesionaria: parsed.data.concesionaria.trim(),
      updated_at:    new Date(),
    })
    .where(eq(schema.tenants.id, tenantId))

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'tenant.update',
    entity:         'tenant',
    entityId:       tenantId,
    meta:           { nombre: parsed.data.nombre, concesionaria: parsed.data.concesionaria },
    visibleToDueno: true,
  })

  revalidatePath('/', 'layout')
  revalidatePath('/configuracion')
  return { success: true, data: undefined }
}

// ── updateSlaConfig ───────────────────────────────────────────
// Umbrales de SLA / alertas de atención por tenant.

export async function updateSlaConfig(input: unknown): Promise<ActionResult<void>> {
  const { error, user, tenantId } = await requireDueno()
  if (error || !user || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  const parsed = slaConfigSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  await dbAdmin
    .update(schema.tenants)
    .set({ sla_config: parsed.data, updated_at: new Date() })
    .where(eq(schema.tenants.id, tenantId))

  void logAudit({
    tenantId,
    actorId:        user.id,
    action:         'tenant.sla_update',
    entity:         'tenant',
    entityId:       tenantId,
    meta:           parsed.data,
    visibleToDueno: true,
  })

  revalidatePath('/configuracion')
  revalidatePath('/dashboard')
  revalidatePath('/leads')
  revalidatePath('/all-leads')
  return { success: true, data: undefined }
}
