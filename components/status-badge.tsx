import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LeadStatus } from '@/lib/leads/constants'

export type { LeadStatus }

// Paleta nueva (5 estados):
//   Nuevo        → slate    — recién entró
//   Contactado   → blue     — comunicación establecida
//   Citado       → violet   — evento crítico del negocio (resaltado)
//   Cerrado      → emerald  — venta confirmada
//   Para rescate → amber    — oportunidad inactiva (no failure)
const map: Record<LeadStatus, string> = {
  'Nuevo':        'bg-slate-100   text-slate-700   border-slate-300/60',
  'Contactado':   'bg-blue-100    text-blue-700    border-blue-300/60',
  'Citado':       'bg-violet-100  text-violet-700  border-violet-300/60',
  'Cerrado':      'bg-emerald-100 text-emerald-700 border-emerald-300/60',
  'Para rescate': 'bg-amber-100   text-amber-700   border-amber-300/60',
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const styles = map[status as LeadStatus] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <Badge variant="outline" className={cn('font-medium border', styles, className)}>
      {status}
    </Badge>
  )
}
