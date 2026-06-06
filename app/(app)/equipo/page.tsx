import { requireRole } from '@/lib/auth/require-role'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, count, sql, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { TeamView } from '@/components/team/team-view'
import { getEquiposConMiembros, getMiembrosDelTenant } from '@/app/actions/equipos'
import { demoradoCondition, getTenantSlaConfig } from '@/lib/leads/server-helpers'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'

export const dynamic = 'force-dynamic'

export default async function EquipoPage() {
  const [user, tenantId] = await Promise.all([
    requireRole('supervisor'),
    getCurrentTenantId(),
  ])
  if (!tenantId) redirect('/login')

  const canManage = ['dueno', 'gerente'].includes(user.rol)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const sla = await getTenantSlaConfig(tenantId)
  const demorado = demoradoCondition(sla.primerContactoHoras)

  // Scope del usuario actual (para supervisor: filtra a su equipo)
  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)
  const supervisorSinEquipo = user.rol === 'supervisor' && scope.type === 'none'

  // Construir filtro extra para el ranking según el scope del usuario
  const scopeFilter: ReturnType<typeof and>[] = []
  if (scope.type === 'team') {
    scopeFilter.push(eq(schema.leads.equipo_id, scope.equipoId))
  } else if (scope.type === 'teams') {
    scopeFilter.push(inArray(schema.leads.equipo_id, scope.equipoIds))
  }
  // scope 'all' → sin filtro; scope 'none' → ranking vacío (supervisorSinEquipo)

  const [rawRanking, equipos, miembros] = await Promise.all([
    supervisorSinEquipo
      ? Promise.resolve([])
      : dbAdmin
          .select({
            user_id:  schema.leads.assigned_to,
            nombre:   schema.usuarios.nombre,
            alias:    schema.usuarios.alias,
            closed:   sql<number>`SUM(CASE WHEN ${schema.leads.status} = 'VENTA' THEN 1 ELSE 0 END)::int`,
            total:    count(),
            atRisk:   sql<number>`SUM(CASE WHEN ${demorado} THEN 1 ELSE 0 END)::int`,
          })
          .from(schema.leads)
          .leftJoin(schema.usuarios, eq(schema.leads.assigned_to, schema.usuarios.id))
          .where(
            and(
              eq(schema.leads.tenant_id, tenantId),
              sql`${schema.leads.assigned_to} IS NOT NULL`,
              sql`${schema.leads.created_at} >= ${startOfMonth}`,
              ...scopeFilter,
            ),
          )
          .groupBy(schema.leads.assigned_to, schema.usuarios.nombre, schema.usuarios.alias),

    canManage ? getEquiposConMiembros() : Promise.resolve([]),
    canManage ? getMiembrosDelTenant()  : Promise.resolve([]),
  ])

  const ranking = rawRanking
    .filter((r) => r.nombre)
    .map((r) => ({
      user_id:    r.user_id ?? '',
      nombre:     r.nombre ?? '—',
      alias:      r.alias,
      closed:     Number(r.closed),
      total:      Number(r.total),
      atRisk:     Number(r.atRisk),
      conversion: r.total > 0 ? Math.round((Number(r.closed) / Number(r.total)) * 100) : 0,
    }))
    .sort((a, b) => b.closed - a.closed || b.conversion - a.conversion)

  return (
    <TeamView
      ranking={ranking}
      equipos={equipos}
      miembros={miembros}
      canManage={canManage}
      supervisorSinEquipo={supervisorSinEquipo}
      userRol={user.rol}
    />
  )
}
