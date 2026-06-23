import { requireAuth } from '@/lib/auth/require-role'
import { getMyLeads, getUnassignedLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant, getAsignablesParaLead } from '@/app/actions/users'
import { getActiveModelNames } from '@/app/actions/modelos'
import { getSourcesCustom } from '@/app/actions/sources'
import { LeadsView } from '@/components/leads/leads-view'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const [user, leads, unassigned, vendedores, asignables, modelos, sourcesCustom] = await Promise.all([
    requireAuth(),
    getMyLeads(),
    getUnassignedLeads(),
    getVendedoresDelTenant(),
    getAsignablesParaLead(),
    getActiveModelNames(),
    getSourcesCustom(),
  ])

  const canCreate = true // todos los roles pueden capturar leads

  // Equipos a los que el jefe puede derivar leads (solo dueño/gerente; vacío resto).
  const teams = asignables.scope === 'all' || asignables.scope === 'teams'
    ? asignables.equipos.map((e) => ({ id: e.id, nombre: e.nombre }))
    : []

  return (
    <LeadsView
      initialLeads={leads}
      initialUnassigned={unassigned}
      vendedores={vendedores}
      teams={teams}
      modelos={modelos}
      customSources={sourcesCustom.filter((s) => s.activo).map((s) => s.nombre)}
      canCreate={canCreate}
    />
  )
}
