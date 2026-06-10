import { requireAuth } from '@/lib/auth/require-role'
import { requireModule } from '@/lib/modules/server'
import { getAllLeads } from '@/app/actions/leads'
import { PipelineView } from '@/components/pipeline/pipeline-view'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  await requireModule('pipeline')
  const [, leads] = await Promise.all([
    requireAuth(),
    getAllLeads(),
  ])

  return <PipelineView initialLeads={leads} />
}
