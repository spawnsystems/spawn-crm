import { requireAuth } from '@/lib/auth/require-role'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, count, sql, inArray, type SQL } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { PerformanceView } from '@/components/performance/performance-view'
import { isBaja } from '@/lib/leads/constants'
import { getMyLeads } from '@/app/actions/leads'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'
import { getMetasVentasMap } from '@/lib/leads/server-helpers'
import { startOfCurrentMonthAR, currentYearMonthAR } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  const [user, tenantId] = await Promise.all([
    requireAuth(),
    getCurrentTenantId(),
  ])
  if (!tenantId) redirect('/login')

  const startOfMonth = startOfCurrentMonthAR().toISOString()

  // Scope del ranking: cada rol ve solo lo que le corresponde, no todo el tenant.
  //   vendedor   → su equipo (o solo él si no tiene equipo)
  //   supervisor → su equipo · gerente → sus equipos · dueño/admin → todo
  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)
  const rankingScope: SQL[] = []
  if (scope.type === 'team') {
    rankingScope.push(eq(schema.leads.equipo_id, scope.equipoId))
  } else if (scope.type === 'teams') {
    rankingScope.push(
      scope.equipoIds.length > 0
        ? inArray(schema.leads.equipo_id, scope.equipoIds)
        : sql`false`,
    )
  } else if (scope.type === 'self') {
    rankingScope.push(
      scope.equipoId
        ? eq(schema.leads.equipo_id, scope.equipoId)
        : eq(schema.leads.assigned_to, user.id),
    )
  } else if (scope.type === 'none') {
    rankingScope.push(sql`false`)
  }
  // scope.type === 'all' → sin filtro

  const { year: curYear, month: curMonth } = currentYearMonthAR()

  const [myLeads, teamRankRaw, metasMap] = await Promise.all([
    // Mis leads (enriquecidos con el estado de atención del engine)
    getMyLeads(),

    // Ranking del equipo (scopeado por rol)
    dbAdmin
      .select({
        user_id: schema.leads.assigned_to,
        nombre:  schema.usuarios.nombre,
        alias:   schema.usuarios.alias,
        closed:  sql<number>`SUM(CASE WHEN ${schema.leads.status} = 'VENTA' THEN 1 ELSE 0 END)::int`,
        total:   count(),
      })
      .from(schema.leads)
      .leftJoin(schema.usuarios, eq(schema.leads.assigned_to, schema.usuarios.id))
      .where(
        and(
          eq(schema.leads.tenant_id, tenantId),
          sql`${schema.leads.assigned_to} IS NOT NULL`,
          sql`${schema.leads.created_at} >= ${startOfMonth}`,
          ...rankingScope,
        ),
      )
      .groupBy(schema.leads.assigned_to, schema.usuarios.nombre, schema.usuarios.alias),

    // Metas del mes (para el cumplimiento propio)
    getMetasVentasMap(tenantId, curYear, curMonth),
  ])

  const myMeta = metasMap[user.id] ?? 0

  // My stats
  const myActive    = myLeads.filter((l) => !isBaja(l.status) && l.status !== 'VENTA').length
  const myClosedM   = myLeads.filter((l) => l.status === 'VENTA').length
  const myMonthTotal = myLeads.length
  const myCloseRate = myMonthTotal > 0 ? Math.round((myClosedM / myMonthTotal) * 100) : 0
  const myAtRisk    = myLeads.filter((l) => l.at_risk).length

  // Funnel — distribución de leads por su etapa ACTUAL. Cada lead cuenta UNA
  // sola vez (en la etapa donde está hoy), así la suma = total de leads no
  // dados de baja. El % es la porción del total que está en cada etapa.
  const nonBaja     = myLeads.filter((l) => !isBaja(l.status))
  const funnelTotal = nonBaja.length
  const inStage = (status: string) => nonBaja.filter((l) => l.status === status).length
  const funnel = [
    { stage: 'Nuevos',             count: inStage('NUEVO') },
    { stage: 'En gestión',         count: inStage('GESTION') },
    { stage: 'Horario asignado',   count: inStage('HORARIO ASIGNADO') },
    { stage: 'Entrevista pactada', count: inStage('ENTREVISTA PACTADA') },
    { stage: 'En cierre',          count: inStage('CIERRE') },
    { stage: 'Ventas',             count: inStage('VENTA') },
  ].map((f) => ({
    ...f,
    pct: funnelTotal > 0 ? Math.round((f.count / funnelTotal) * 100) : 0,
  }))

  // Team ranking
  const ranking = teamRankRaw
    .filter((r) => r.nombre)
    .map((r) => ({
      user_id:    r.user_id ?? '',
      nombre:     r.nombre ?? '—',
      alias:      r.alias,
      closed:     Number(r.closed),
      total:      Number(r.total),
      conversion: r.total > 0 ? Math.round((Number(r.closed) / Number(r.total)) * 100) : 0,
      isMe:       r.user_id === user.id,
    }))
    .sort((a, b) => b.closed - a.closed || b.conversion - a.conversion)

  return (
    <PerformanceView
      myActive={myActive}
      myClosedMonth={myClosedM}
      myCloseRate={myCloseRate}
      myAtRisk={myAtRisk}
      myMeta={myMeta}
      funnel={funnel}
      ranking={ranking}
    />
  )
}
