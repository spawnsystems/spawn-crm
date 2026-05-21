import { requireAuth } from '@/lib/auth/require-role'
import { getMyLeads, getAllLeads } from '@/app/actions/leads'
import { PipelineView } from '@/components/pipeline/pipeline-view'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const user = await requireAuth()

  // Vendedores ven solo sus leads; supervisores y superiores ven todo el equipo
  const leads = ['vendedor'].includes(user.rol)
    ? await getMyLeads()
    : await getAllLeads()

  return <PipelineView initialLeads={leads} />
}
