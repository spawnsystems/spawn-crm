import { requireRole } from '@/lib/auth/require-role'
import { getCurrentTenantId } from '@/lib/tenant/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq, and, count, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { TeamView } from '@/components/team/team-view'
import { getEquiposConMiembros, getMiembrosDelTenant } from '@/app/actions/equipos'

export const dynamic = 'force-dynamic'

export default async function EquipoPage() {
  const [user, tenantId] = await Promise.all([
    requireRole('supervisor'),
    getCurrentTenantId(),
  ])
  if (!tenantId) redirect('/login')

  const canManage = ['platform_admin', 'dueno', 'gerente'].includes(user.rol)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [rawRanking, equipos, miembros] = await Promise.all([
    dbAdmin
      .select({
        user_id:  schema.leads.assigned_to,
        nombre:   schema.usuarios.nombre,
        alias:    schema.usuarios.alias,
        closed:   sql<number>`SUM(CASE WHEN ${schema.leads.status} = 'Cerrado' THEN 1 ELSE 0 END)::int`,
        total:    count(),
        atRisk:   sql<number>`SUM(CASE WHEN ${schema.leads.at_risk} = true THEN 1 ELSE 0 END)::int`,
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
    />
  )
}
