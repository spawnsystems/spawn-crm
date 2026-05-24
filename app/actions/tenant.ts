'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { tenantInfoSchema } from '@/lib/schemas/configuracion'
import type { ActionResult } from './auth'

// ── Guard ─────────────────────────────────────────────────────

async function requireDueno() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return { error: 'No autenticado' as const, tenantId: null }
  if (!['platform_admin', 'dueno'].includes(user.rol)) {
    return { error: 'Solo el dueño puede editar la concesionaria' as const, tenantId: null }
  }
  return { error: null, tenantId }
}

// ── updateTenantInfo ──────────────────────────────────────────

export async function updateTenantInfo(input: unknown): Promise<ActionResult<void>> {
  const { error, tenantId } = await requireDueno()
  if (error || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

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

  revalidatePath('/', 'layout')
  revalidatePath('/configuracion')
  return { success: true, data: undefined }
}
