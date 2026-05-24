'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { sourceCustomSchema } from '@/lib/schemas/configuracion'
import type { ActionResult } from './auth'

// ── Guard ─────────────────────────────────────────────────────

async function requireGerente() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return { error: 'No autenticado' as const, tenantId: null }
  if (!['platform_admin', 'dueno', 'gerente'].includes(user.rol)) {
    return { error: 'Sin permisos para gestionar fuentes' as const, tenantId: null }
  }
  return { error: null, tenantId }
}

// ── getSourcesCustom ──────────────────────────────────────────

export async function getSourcesCustom() {
  const [user, tenantId] = await Promise.all([getCurrentUser(), getCurrentTenantId()])
  if (!user || !tenantId) return []

  return dbAdmin
    .select({
      id:     schema.leadSourcesCustom.id,
      nombre: schema.leadSourcesCustom.nombre,
      activo: schema.leadSourcesCustom.activo,
    })
    .from(schema.leadSourcesCustom)
    .where(eq(schema.leadSourcesCustom.tenant_id, tenantId))
    .orderBy(schema.leadSourcesCustom.nombre)
}

// ── createSourceCustom ────────────────────────────────────────

export async function createSourceCustom(
  nombre: string,
): Promise<ActionResult<{ id: string }>> {
  const { error, tenantId } = await requireGerente()
  if (error || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  const parsed = sourceCustomSchema.safeParse({ nombre })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Nombre inválido' }

  // Verificar duplicado
  const existing = await dbAdmin
    .select({ id: schema.leadSourcesCustom.id })
    .from(schema.leadSourcesCustom)
    .where(
      and(
        eq(schema.leadSourcesCustom.tenant_id, tenantId),
        eq(schema.leadSourcesCustom.nombre, parsed.data.nombre.trim()),
      ),
    )
    .limit(1)

  if (existing[0]) return { success: false, error: 'Ya existe una fuente con ese nombre' }

  const [row] = await dbAdmin
    .insert(schema.leadSourcesCustom)
    .values({ tenant_id: tenantId, nombre: parsed.data.nombre.trim() })
    .returning({ id: schema.leadSourcesCustom.id })

  revalidatePath('/configuracion')
  return { success: true, data: { id: row.id } }
}

// ── toggleSourceCustom ────────────────────────────────────────

export async function toggleSourceCustom(id: string): Promise<ActionResult<void>> {
  const { error, tenantId } = await requireGerente()
  if (error || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  const [row] = await dbAdmin
    .select({ activo: schema.leadSourcesCustom.activo })
    .from(schema.leadSourcesCustom)
    .where(
      and(
        eq(schema.leadSourcesCustom.id, id),
        eq(schema.leadSourcesCustom.tenant_id, tenantId),
      ),
    )
    .limit(1)

  if (!row) return { success: false, error: 'Fuente no encontrada' }

  await dbAdmin
    .update(schema.leadSourcesCustom)
    .set({ activo: !row.activo })
    .where(
      and(
        eq(schema.leadSourcesCustom.id, id),
        eq(schema.leadSourcesCustom.tenant_id, tenantId),
      ),
    )

  revalidatePath('/configuracion')
  return { success: true, data: undefined }
}

// ── deleteSourceCustom ────────────────────────────────────────

export async function deleteSourceCustom(id: string): Promise<ActionResult<void>> {
  const { error, tenantId } = await requireGerente()
  if (error || !tenantId) return { success: false, error: error ?? 'Sin permisos' }

  await dbAdmin
    .delete(schema.leadSourcesCustom)
    .where(
      and(
        eq(schema.leadSourcesCustom.id, id),
        eq(schema.leadSourcesCustom.tenant_id, tenantId),
      ),
    )

  revalidatePath('/configuracion')
  return { success: true, data: undefined }
}
