'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { metaVentasSchema } from '@/lib/schemas/configuracion'
import type { ActionResult } from './auth'

// ── Guard ─────────────────────────────────────────────────────

async function requireDueno() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return { error: 'No autenticado' as const, tenantId: null }
  if (!['platform_admin', 'dueno'].includes(user.rol)) {
    return { error: 'Solo el dueño puede gestionar metas' as const, tenantId: null }
  }
  return { error: null, tenantId }
}

// ── getMetasMensuales ─────────────────────────────────────────
// Devuelve todas las metas de un año para el tenant, como array plano.
// La UI construye la grilla vendedor × mes.

export async function getMetasMensuales(anio: number) {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return []

  return dbAdmin
    .select({
      user_id:     schema.metasMensuales.user_id,
      mes:         schema.metasMensuales.mes,
      meta_ventas: schema.metasMensuales.meta_ventas,
    })
    .from(schema.metasMensuales)
    .where(
      and(
        eq(schema.metasMensuales.tenant_id, tenantId),
        eq(schema.metasMensuales.anio, anio),
      ),
    )
}

// ── upsertMetaMensual ─────────────────────────────────────────
// Inserta o actualiza la meta de un vendedor para un mes.

export async function upsertMetaMensual(
  input: unknown,
): Promise<ActionResult<void>> {
  const { error, tenantId } = await requireDueno()
  if (error || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  const parsed = metaVentasSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const { user_id, anio, mes, meta_ventas } = parsed.data

  await dbAdmin
    .insert(schema.metasMensuales)
    .values({
      tenant_id:   tenantId,
      user_id,
      anio,
      mes,
      meta_ventas,
    })
    .onConflictDoUpdate({
      target: [
        schema.metasMensuales.tenant_id,
        schema.metasMensuales.user_id,
        schema.metasMensuales.anio,
        schema.metasMensuales.mes,
      ],
      set: {
        meta_ventas,
        updated_at: new Date(),
      },
    })

  revalidatePath('/configuracion')
  revalidatePath('/performance')
  return { success: true, data: undefined }
}
