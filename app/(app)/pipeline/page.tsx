import { requireAuth } from '@/lib/auth/require-role'
import { getAllLeads } from '@/app/actions/leads'
import { PipelineView } from '@/components/pipeline/pipeline-view'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const [, leads] = await Promise.all([
    requireAuth(),
    getAllLeads(),
  ])

  return <PipelineView initialLeads={leads} />
}
