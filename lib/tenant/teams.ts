/**
 * lib/tenant/teams.ts
 * Helpers de jerarquía de equipos — define qué leads puede ver cada rol.
 * Server-only.
 */

import { dbAdmin, schema } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { AppRole } from '@/lib/auth/get-current-user'

// ── TeamScope ─────────────────────────────────────────────────
// Define el alcance de visibilidad de leads según el rol del usuario.

export type TeamScope =
  | { type: 'all' }                              // dueno / platform_admin
  | { type: 'teams'; equipoIds: string[] }       // gerente (N equipos)
  | { type: 'team';  equipoId: string }          // supervisor (1 equipo)
  | { type: 'self';  userId: string }            // vendedor (solo propios)
  | { type: 'none' }                             // sin acceso

/**
 * Retorna el TeamScope del usuario actual según su rol en el tenant.
 */
export async function getCurrentUserTeamScope(
  userId: string,
  tenantId: string,
  rol: AppRole,
): Promise<TeamScope> {
  if (rol === 'platform_admin' || rol === 'dueno') {
    return { type: 'all' }
  }

  if (rol === 'gerente') {
    const equipos = await dbAdmin
      .select({ id: schema.equipos.id })
      .from(schema.equipos)
      .where(
        and(
          eq(schema.equipos.tenant_id, tenantId),
          eq(schema.equipos.gerente_id, userId),
          eq(schema.equipos.activo, true),
        ),
      )
    const ids = equipos.map((e) => e.id)
    return ids.length > 0
      ? { type: 'teams', equipoIds: ids }
      : { type: 'none' }
  }

  if (rol === 'supervisor') {
    const equipo = await dbAdmin
      .select({ id: schema.equipos.id })
      .from(schema.equipos)
      .where(
        and(
          eq(schema.equipos.tenant_id, tenantId),
          eq(schema.equipos.supervisor_id, userId),
          eq(schema.equipos.activo, true),
        ),
      )
      .limit(1)
    return equipo[0]
      ? { type: 'team', equipoId: equipo[0].id }
      : { type: 'none' }
  }

  // vendedor
  return { type: 'self', userId }
}

/**
 * Construye la condición WHERE de Drizzle para filtrar leads según el TeamScope.
 * Devuelve null si el scope es 'all' (sin filtro adicional).
 *
 * @example
 * const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)
 * const scopeWhere = buildScopeWhere(scope)
 * const rows = await q.select().from(schema.leads)
 *   .where(and(
 *     eq(schema.leads.tenant_id, tenantId),
 *     ...(scopeWhere ? [scopeWhere] : [])
 *   ))
 */
export function buildScopeWhere(scope: TeamScope): SQL | null {
  const { inArray, isNull, or, eq } = require('drizzle-orm')

  switch (scope.type) {
    case 'all':
      return null

    case 'teams':
      return scope.equipoIds.length > 0
        ? inArray(schema.leads.equipo_id, scope.equipoIds)
        : eq(schema.leads.id, 'no-match') // scope vacío → 0 resultados

    case 'team':
      return eq(schema.leads.equipo_id, scope.equipoId)

    case 'self':
      // vendedor ve sus propios leads + los sin asignar (Bandeja General)
      return or(
        eq(schema.leads.assigned_to, scope.userId),
        isNull(schema.leads.assigned_to),
      )!

    case 'none':
    default:
      return eq(schema.leads.id, 'no-match')
  }
}
