import { requireRole } from '@/lib/auth/require-role'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, sql, type SQL } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { getAttentionSummary } from '@/app/actions/leads'
import { startOfCurrentMonthAR, currentYearMonthAR } from '@/lib/utils'
import { getCurrentUserTeamScope, buildScopeWhere } from '@/lib/tenant/teams'
import { getMetasVentasMap } from '@/lib/leads/server-helpers'
import { sourceLabel } from '@/lib/leads/constants'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [user, tenantId] = await Promise.all([
    requireRole('supervisor'),
    getCurrentTenantId(),
  ])
  if (!tenantId) redirect('/login')

  const startOfMonth = startOfCurrentMonthAR().toISOString()

  // Scope por rol: supervisor → su equipo · gerente → sus equipos · dueño/admin → todo.
  // Antes el dashboard consultaba TODO el tenant sin filtrar; eso filtraba data de
  // otros equipos a supervisores/gerentes. Ahora cada rol ve solo lo suyo.
  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)
  const scopeWhere = buildScopeWhere(scope)
  const scoped = (...conds: SQL[]) =>
    and(
      eq(schema.leads.tenant_id, tenantId),
      ...(scopeWhere ? [scopeWhere] : []),
      ...conds,
    )

  // ── Query principal: un row por lead del mes (scopeado) con el momento del
  //    primer contacto real, derivado del timeline. "Primer contacto" = el
  //    evento más temprano en que el vendedor efectivamente alcanzó/agendó al
  //    cliente (llamada registrada o cita pactada). Es la señal de respuesta.
  const firstContactSql = sql<Date | null>`(
    SELECT MIN(t.created_at) FROM ${schema.leadTimeline} t
    WHERE t.lead_id = ${schema.leads.id}
      AND t.event_type IN ('call_registered', 'appointment_scheduled')
  )`

  const { year: curYear, month: curMonth } = currentYearMonthAR()

  const [leadsRaw, attention, metasMap] = await Promise.all([
    dbAdmin
      .select({
        id:               schema.leads.id,
        source:           schema.leads.source,
        source_custom:    schema.leads.source_custom,
        status:           schema.leads.status,
        seller_id:        schema.leads.assigned_to,
        seller_nombre:    schema.usuarios.nombre,
        seller_alias:     schema.usuarios.alias,
        created_at:       schema.leads.created_at,
        first_contact_at: firstContactSql,
      })
      .from(schema.leads)
      .leftJoin(schema.usuarios, eq(schema.leads.assigned_to, schema.usuarios.id))
      .where(scoped(sql`${schema.leads.created_at} >= ${startOfMonth}`)),

    // Resumen de atención (ya scopeado por rol internamente)
    getAttentionSummary(),

    // Metas del mes (cumplimiento por vendedor + total del equipo)
    getMetasVentasMap(tenantId, curYear, curMonth),
  ])

  // ── Helpers de agregación en JS ──────────────────────────────
  const respMinutes = (l: (typeof leadsRaw)[number]): number | null => {
    if (!l.first_contact_at) return null
    const created = new Date(l.created_at).getTime()
    const contact = new Date(l.first_contact_at).getTime()
    const min = Math.round((contact - created) / 60000)
    return min >= 0 ? min : 0
  }

  // KPIs generales del mes
  const monthLeads  = leadsRaw.length
  const monthClosed = leadsRaw.filter((l) => l.status === 'VENTA').length
  const conversionRate = monthLeads > 0 ? Math.round((monthClosed / monthLeads) * 100) : 0
  const atRiskNow   = attention.total

  // ── Tiempo de respuesta ──────────────────────────────────────
  // Tramos sobre leads contactados; los no contactados se cuentan aparte.
  const contacted = leadsRaw.map(respMinutes).filter((m): m is number => m !== null)
  const sinContactar = monthLeads - contacted.length
  const avgRespMin = contacted.length > 0
    ? Math.round(contacted.reduce((a, m) => a + m, 0) / contacted.length)
    : null
  // Mediana — más robusta que el promedio ante outliers (un lead que se contactó a los 5 días)
  const medianRespMin = (() => {
    if (contacted.length === 0) return null
    const sorted = [...contacted].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid]
  })()

  const respBuckets = [
    { label: '≤ 15 min', test: (m: number) => m <= 15 },
    { label: '≤ 1 hora', test: (m: number) => m > 15 && m <= 60 },
    { label: '≤ 24 hs',  test: (m: number) => m > 60 && m <= 1440 },
    { label: '+ 24 hs',  test: (m: number) => m > 1440 },
  ].map((b) => {
    const count = contacted.filter(b.test).length
    return { label: b.label, count, pct: monthLeads > 0 ? Math.round((count / monthLeads) * 100) : 0 }
  })
  // Tramo extra: sin contactar todavía
  respBuckets.push({
    label: 'Sin contactar',
    count: sinContactar,
    pct: monthLeads > 0 ? Math.round((sinContactar / monthLeads) * 100) : 0,
  })

  const responseTime = {
    avgMin:        avgRespMin,
    medianMin:     medianRespMin,
    contacted:     contacted.length,
    sinContactar,
    total:         monthLeads,
    buckets:       respBuckets,
  }

  // ── Conversión por origen ────────────────────────────────────
  // Agrupamos por la etiqueta visible: las fuentes personalizadas se cuentan por
  // su nombre real (no colapsadas en "Otro").
  const sourceMap = new Map<string, { total: number; closed: number }>()
  for (const l of leadsRaw) {
    const label = sourceLabel(l.source, l.source_custom)
    const s = sourceMap.get(label) ?? { total: 0, closed: 0 }
    s.total += 1
    if (l.status === 'VENTA') s.closed += 1
    sourceMap.set(label, s)
  }
  const sources = [...sourceMap.entries()]
    .map(([name, v]) => ({
      name,
      count:      v.total,
      closed:     v.closed,
      conversion: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0,
      share:      monthLeads > 0 ? Math.round((v.total / monthLeads) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // ── Detalle por vendedor ─────────────────────────────────────
  const attBySeller = new Map(attention.bySeller.map((s) => [s.name, s.count]))
  const sellerMap = new Map<string, {
    nombre: string; alias: string | null
    total: number; closed: number; contacted: number; respSum: number; respN: number
  }>()
  for (const l of leadsRaw) {
    if (!l.seller_id || !l.seller_nombre) continue
    const key = l.seller_id
    const acc = sellerMap.get(key) ?? {
      nombre: l.seller_nombre, alias: l.seller_alias,
      total: 0, closed: 0, contacted: 0, respSum: 0, respN: 0,
    }
    acc.total += 1
    if (l.status === 'VENTA') acc.closed += 1
    const rm = respMinutes(l)
    if (rm !== null) { acc.contacted += 1; acc.respSum += rm; acc.respN += 1 }
    sellerMap.set(key, acc)
  }
  const sellers = [...sellerMap.entries()]
    .map(([sellerId, s]) => {
      const displayName = s.alias || s.nombre
      const meta = metasMap[sellerId] ?? 0
      return {
        nombre:      s.nombre,
        alias:       s.alias,
        total:       s.total,
        closed:      s.closed,
        atRisk:      attBySeller.get(displayName) ?? 0,
        conversion:  s.total > 0 ? Math.round((s.closed / s.total) * 100) : 0,
        contacted:   s.contacted,
        contactRate: s.total > 0 ? Math.round((s.contacted / s.total) * 100) : 0,
        avgRespMin:  s.respN > 0 ? Math.round(s.respSum / s.respN) : null,
        meta,
        metaPct:     meta > 0 ? Math.round((s.closed / meta) * 100) : null,
      }
    })
    .sort((a, b) => b.closed - a.closed || b.conversion - a.conversion)

  // Cumplimiento de meta del equipo. Sumamos solo las metas de los vendedores
  // que están dentro del scope actual (los que tienen leads del mes en este
  // tablero), para no filtrar metas de otros equipos a supervisores/gerentes.
  const totalMeta = [...sellerMap.keys()].reduce((a, id) => a + (metasMap[id] ?? 0), 0)
  const metaCumplimiento = {
    closed:  monthClosed,
    meta:    totalMeta,
    pct:     totalMeta > 0 ? Math.round((monthClosed / totalMeta) * 100) : null,
  }

  return (
    <DashboardView
      monthLeads={monthLeads}
      monthClosed={monthClosed}
      conversionRate={conversionRate}
      atRiskNow={atRiskNow}
      attention={attention}
      sellers={sellers}
      sources={sources}
      totalLeads={monthLeads}
      responseTime={responseTime}
      metaCumplimiento={metaCumplimiento}
    />
  )
}
