import { requireAuth } from '@/lib/auth/require-role'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, count, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { PerformanceView } from '@/components/performance/performance-view'

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  const [user, tenantId] = await Promise.all([
    requireAuth(),
    getCurrentTenantId(),
  ])
  if (!tenantId) redirect('/login')

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const [myLeads, teamRankRaw] = await Promise.all([
    // My own leads
    dbAdmin
      .select()
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenant_id, tenantId),
          eq(schema.leads.assigned_to, user.id),
        ),
      ),

    // Team ranking (all sellers in tenant)
    dbAdmin
      .select({
        user_id: schema.leads.assigned_to,
        nombre:  schema.usuarios.nombre,
        alias:   schema.usuarios.alias,
        closed:  sql<number>`SUM(CASE WHEN ${schema.leads.status} = 'Cerrado' THEN 1 ELSE 0 END)::int`,
        total:   count(),
      })
      .from(schema.leads)
      .leftJoin(schema.usuarios, eq(schema.leads.assigned_to, schema.usuarios.id))
      .where(
        and(
          eq(schema.leads.tenant_id, tenantId),
          sql`${schema.leads.assigned_to} IS NOT NULL`,
          sql`${schema.leads.created_at} >= ${startOfMonth}`,
        ),
      )
      .groupBy(schema.leads.assigned_to, schema.usuarios.nombre, schema.usuarios.alias),
  ])

  // My stats
  const myActive    = myLeads.filter((l) => !['Cerrado', 'Perdido'].includes(l.status)).length
  const myClosedM   = myLeads.filter((l) => l.status === 'Cerrado').length
  const myMonthTotal = myLeads.length
  const myCloseRate = myMonthTotal > 0 ? Math.round((myClosedM / myMonthTotal) * 100) : 0
  const myAtRisk    = myLeads.filter((l) => l.at_risk).length

  // Funnel
  const funnel = [
    { stage: 'Asignados',   count: myLeads.length },
    { stage: 'Contactados', count: myLeads.filter((l) => !['Nuevo'].includes(l.status)).length },
    { stage: 'Cotizados',   count: myLeads.filter((l) => ['Cotizado', 'Test drive', 'Negociación', 'Cerrado'].includes(l.status)).length },
    { stage: 'Test Drive',  count: myLeads.filter((l) => ['Test drive', 'Negociación', 'Cerrado'].includes(l.status)).length },
    { stage: 'Negociación', count: myLeads.filter((l) => ['Negociación', 'Cerrado'].includes(l.status)).length },
    { stage: 'Cerrados',    count: myClosedM },
  ].map((f) => ({
    ...f,
    pct: myLeads.length > 0 ? Math.round((f.count / myLeads.length) * 100) : 0,
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
      funnel={funnel}
      ranking={ranking}
    />
  )
}
