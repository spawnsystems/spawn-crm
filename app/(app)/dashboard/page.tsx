import { requireRole } from '@/lib/auth/require-role'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, count, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [user, tenantId] = await Promise.all([
    requireRole('supervisor'),
    getCurrentTenantId(),
  ])
  if (!tenantId) redirect('/login')

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  // ── Aggregate queries ────────────────────────────────────────

  const [
    totalResult,
    closedResult,
    atRiskResult,
    sellersRaw,
    sourceRaw,
  ] = await Promise.all([
    // Total leads this month
    dbAdmin
      .select({ count: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenant_id, tenantId),
          sql`${schema.leads.created_at} >= ${startOfMonth}`,
        ),
      ),

    // Closed this month
    dbAdmin
      .select({ count: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenant_id, tenantId),
          eq(schema.leads.status, 'VENTA'),
          sql`${schema.leads.created_at} >= ${startOfMonth}`,
        ),
      ),

    // At risk now
    dbAdmin
      .select({ count: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenant_id, tenantId),
          eq(schema.leads.at_risk, true),
        ),
      ),

    // Sellers performance
    dbAdmin
      .select({
        nombre:  schema.usuarios.nombre,
        alias:   schema.usuarios.alias,
        total:   count(),
        closed:  sql<number>`SUM(CASE WHEN ${schema.leads.status} = 'VENTA' THEN 1 ELSE 0 END)::int`,
        atRisk:  sql<number>`SUM(CASE WHEN ${schema.leads.at_risk} = true THEN 1 ELSE 0 END)::int`,
        avgResp: sql<number>`0`,
      })
      .from(schema.leads)
      .leftJoin(schema.usuarios, eq(schema.leads.assigned_to, schema.usuarios.id))
      .where(
        and(
          eq(schema.leads.tenant_id, tenantId),
          sql`${schema.leads.assigned_to} IS NOT NULL`,
        ),
      )
      .groupBy(schema.usuarios.nombre, schema.usuarios.alias),

    // Source breakdown
    dbAdmin
      .select({
        source: schema.leads.source,
        total:  count(),
      })
      .from(schema.leads)
      .where(eq(schema.leads.tenant_id, tenantId))
      .groupBy(schema.leads.source),
  ])

  const monthLeads     = totalResult[0]?.count  ?? 0
  const monthClosed    = closedResult[0]?.count  ?? 0
  const atRiskNow      = atRiskResult[0]?.count  ?? 0
  const conversionRate = monthLeads > 0
    ? Math.round((monthClosed / monthLeads) * 100)
    : 0

  // Sellers sorted by closed desc
  const sellers = sellersRaw
    .filter((s) => s.nombre)
    .map((s) => ({
      nombre:     s.nombre ?? '—',
      alias:      s.alias,
      total:      Number(s.total),
      closed:     Number(s.closed),
      atRisk:     Number(s.atRisk),
      conversion: s.total > 0 ? Math.round((Number(s.closed) / Number(s.total)) * 100) : 0,
    }))
    .sort((a, b) => b.closed - a.closed || b.conversion - a.conversion)

  // Source data (total count per source)
  const totalAll = sourceRaw.reduce((acc, s) => acc + Number(s.total), 0)
  const sources = sourceRaw.map((s) => ({
    name:  s.source,
    value: totalAll > 0 ? Math.round((Number(s.total) / totalAll) * 100) : 0,
    count: Number(s.total),
  })).sort((a, b) => b.count - a.count)

  return (
    <DashboardView
      monthLeads={monthLeads}
      monthClosed={monthClosed}
      conversionRate={conversionRate}
      atRiskNow={atRiskNow}
      sellers={sellers}
      sources={sources}
      totalLeads={totalAll}
    />
  )
}
