import { requireRole } from '@/lib/auth/require-role'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, count, sql, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { TeamView } from '@/components/team/team-view'
import { getEquiposConMiembros, getMiembrosDelTenant } from '@/app/actions/equipos'
import { getTeamAttentionCountByUser } from '@/lib/leads/server-helpers'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'
import { startOfCurrentMonthAR } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function EquipoPage() {
  const [user, tenantId] = await Promise.all([
    requireRole('vendedor'),
    getCurrentTenantId(),
  ])
  if (!tenantId) redirect('/login')

  const canManage = ['dueno', 'gerente'].includes(user.rol)
  const startOfMonth = startOfCurrentMonthAR().toISOString()

  // Scope del usuario actual
  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)
  const supervisorSinEquipo = user.rol === 'supervisor' && scope.type === 'none'

  // Para vendedor: getCurrentUserTeamScope devuelve 'self', no el equipo.
  // Hay que buscarlo directamente en tenant_members.
  let vendedorEquipoId:   string | null = null
  let vendedorTeamName:   string | null = null
  let vendedorSinEquipo                 = false

  if (user.rol === 'vendedor') {
    const member = await dbAdmin
      .select({ equipo_id: schema.tenantMembers.equipo_id })
      .from(schema.tenantMembers)
      .where(and(
        eq(schema.tenantMembers.tenant_id, tenantId),
        eq(schema.tenantMembers.user_id, user.id),
      ))
      .limit(1)
    vendedorEquipoId = member[0]?.equipo_id ?? null

    if (!vendedorEquipoId) {
      vendedorSinEquipo = true
    } else {
      const equipoRow = await dbAdmin
        .select({ nombre: schema.equipos.nombre })
        .from(schema.equipos)
        .where(eq(schema.equipos.id, vendedorEquipoId))
        .limit(1)
      vendedorTeamName = equipoRow[0]?.nombre ?? null
    }
  }

  // Filtro de scope para el ranking
  const scopeFilter: ReturnType<typeof eq>[] = []
  if (scope.type === 'team') {
    scopeFilter.push(eq(schema.leads.equipo_id, scope.equipoId))
  } else if (scope.type === 'teams' && scope.equipoIds.length > 0) {
    // inArray devuelve SQL — usamos un cast compatible
    scopeFilter.push(inArray(schema.leads.equipo_id, scope.equipoIds) as unknown as ReturnType<typeof eq>)
  } else if (user.rol === 'vendedor' && vendedorEquipoId) {
    scopeFilter.push(eq(schema.leads.equipo_id, vendedorEquipoId))
  }

  const skipRanking = supervisorSinEquipo || vendedorSinEquipo

  // Equipos a incluir en el conteo de atención (scope ya verificado por rol).
  // null = todo el tenant (dueño/admin); [] vía skipRanking se evita más abajo.
  let attentionEquipoIds: string[] | null = null
  if (scope.type === 'team') attentionEquipoIds = [scope.equipoId]
  else if (scope.type === 'teams') attentionEquipoIds = scope.equipoIds
  else if (user.rol === 'vendedor' && vendedorEquipoId) attentionEquipoIds = [vendedorEquipoId]

  const [rawRanking, attentionByUser, equipos, miembros] = await Promise.all([
    skipRanking
      ? Promise.resolve([])
      : dbAdmin
          .select({
            user_id:  schema.leads.assigned_to,
            nombre:   schema.usuarios.nombre,
            alias:    schema.usuarios.alias,
            closed:   sql<number>`SUM(CASE WHEN ${schema.leads.status} = 'VENTA' THEN 1 ELSE 0 END)::int`,
            total:    count(),
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

    skipRanking
      ? Promise.resolve({} as Record<string, number>)
      : getTeamAttentionCountByUser(tenantId, attentionEquipoIds),

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
      atRisk:     r.user_id ? (attentionByUser[r.user_id] ?? 0) : 0,
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
      vendedorSinEquipo={vendedorSinEquipo}
      userRol={user.rol}
      currentUserId={user.id}
      teamName={vendedorTeamName}
    />
  )
}
