import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { statusLabel, type LeadStatus } from '@/lib/leads/constants'

export type { LeadStatus }

// Paleta (11 estados):
//   Activos:
//     GESTIÓN            → slate    — en gestión
//     HORARIO ASIGNADO   → sky      — horario de contacto pactado
//     ENTREVISTA PACTADA → violet   — evento crítico del negocio (resaltado)
//     CIERRE             → indigo   — en proceso de cierre
//     VENTA              → emerald  — venta concretada
//   Baja:
//     NO CONTESTA        → amber
//     NO INTERESADO      → rose
//     INCONTACTABLE      → zinc
//     YA COMPRÓ          → orange
//     DATO ERRÓNEO       → neutral
//     DERIVAR            → cyan
const map: Record<LeadStatus, string> = {
  'NUEVO':              'bg-blue-100    text-blue-700    border-blue-300/60',
  'GESTION':            'bg-slate-100   text-slate-700   border-slate-300/60',
  'HORARIO ASIGNADO':   'bg-sky-100     text-sky-700     border-sky-300/60',
  'ENTREVISTA PACTADA': 'bg-violet-100  text-violet-700  border-violet-300/60',
  'CIERRE':             'bg-indigo-100  text-indigo-700  border-indigo-300/60',
  'VENTA':              'bg-emerald-100 text-emerald-700 border-emerald-300/60',
  'NO CONTESTA':        'bg-amber-100   text-amber-700   border-amber-300/60',
  'NO INTERESADO':      'bg-rose-100    text-rose-700    border-rose-300/60',
  'INCONTACTABLE':      'bg-zinc-100    text-zinc-600    border-zinc-300/60',
  'YA COMPRO':          'bg-orange-100  text-orange-700  border-orange-300/60',
  'DATO ERRONEO':       'bg-neutral-100 text-neutral-600 border-neutral-300/60',
  'DERIVAR':            'bg-cyan-100    text-cyan-700    border-cyan-300/60',
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
      {statusLabel(status)}
    </Badge>
  )
}
