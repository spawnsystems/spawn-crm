import { requireRole } from '@/lib/auth/require-role'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, count, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { getAttentionSummary } from '@/app/actions/leads'
import { startOfCurrentMonthAR } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [user, tenantId] = await Promise.all([
    requireRole('supervisor'),
    getCurrentTenantId(),
  ])
  if (!tenantId) redirect('/login')

  const startOfMonth = startOfCurrentMonthAR().toISOString()

  // ── Aggregate queries ────────────────────────────────────────

  const [
    totalResult,
    closedResult,
    attention,
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

    // Resumen de atención (scopeado por rol, derivado por el engine)
    getAttentionSummary(),

    // Sellers performance
    dbAdmin
      .select({
        nombre:  schema.usuarios.nombre,
        alias:   schema.usuarios.alias,
        total:   count(),
        closed:  sql<number>`SUM(CASE WHEN ${schema.leads.status} = 'VENTA' THEN 1 ELSE 0 END)::int`,
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
  const atRiskNow      = attention.total
  const conversionRate = monthLeads > 0
    ? Math.round((monthClosed / monthLeads) * 100)
    : 0

  // Atención por vendedor → lookup por nombre visible (alias || nombre)
  const attBySeller = new Map(attention.bySeller.map((s) => [s.name, s.count]))

  // Sellers sorted by closed desc
  const sellers = sellersRaw
    .filter((s) => s.nombre)
    .map((s) => {
      const displayName = s.alias || s.nombre || '—'
      return {
        nombre:     s.nombre ?? '—',
        alias:      s.alias,
        total:      Number(s.total),
        closed:     Number(s.closed),
        atRisk:     attBySeller.get(displayName) ?? 0,
        conversion: s.total > 0 ? Math.round((Number(s.closed) / Number(s.total)) * 100) : 0,
      }
    })
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
      attention={attention}
      sellers={sellers}
      sources={sources}
      totalLeads={totalAll}
    />
  )
}
