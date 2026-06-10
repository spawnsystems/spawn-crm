/**
 * lib/modules/server.ts
 * Helpers server-only para el estado de módulos por tenant.
 *
 * Modelo: un módulo está ACTIVO por defecto. Solo se considera apagado si existe
 * una fila explícita en tenant_modules con enabled = false. Así, los tenants que
 * no tienen filas (o módulos nuevos) no pierden secciones.
 */

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { dbAdmin, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { MODULE_KEYS, type ModuleKey } from './definitions'

/**
 * Devuelve el set de módulos ACTIVOS (efectivo) para un tenant.
 * Ausencia de fila = activo; solo se excluye lo explícitamente apagado.
 */
export const getEnabledModules = cache(async (tenantId: string): Promise<ModuleKey[]> => {
  const rows = await dbAdmin
    .select({ key: schema.tenantModules.module_key, enabled: schema.tenantModules.enabled })
    .from(schema.tenantModules)
    .where(eq(schema.tenantModules.tenant_id, tenantId))

  const disabled = new Set(
    rows.filter((r) => !r.enabled).map((r) => r.key as ModuleKey),
  )
  return MODULE_KEYS.filter((k) => !disabled.has(k))
})

/** True si el módulo está activo para el tenant. */
export async function isModuleEnabled(tenantId: string, key: ModuleKey): Promise<boolean> {
  const enabled = await getEnabledModules(tenantId)
  return enabled.includes(key)
}

/**
 * Guard para páginas: redirige a "/" si el módulo está apagado para el tenant
 * actual. Usar al inicio de los Server Components de cada sección modular.
 */
export async function requireModule(key: ModuleKey): Promise<void> {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) redirect('/login')
  const ok = await isModuleEnabled(tenantId, key)
  if (!ok) redirect('/')
}
