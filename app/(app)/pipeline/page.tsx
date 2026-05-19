import { requireAuth } from '@/lib/auth/require-role'
import { getMyLeads } from '@/app/actions/leads'
import { PipelineView } from '@/components/pipeline/pipeline-view'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const [, leads] = await Promise.all([
    requireAuth(),
    getMyLeads(),
  ])

  return <PipelineView initialLeads={leads} />
}
