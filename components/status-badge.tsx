import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type LeadStatus =
  | 'Nuevo'
  | 'Contactado'
  | 'Cotizado'
  | 'Test drive'
  | 'Negociación'
  | 'Cerrado'
  | 'Perdido'

const map: Record<LeadStatus, string> = {
  'Nuevo':       'bg-info-soft text-info border-info/20',
  'Contactado':  'bg-primary-soft text-primary border-primary/20',
  'Cotizado':    'bg-warning-soft text-warning-foreground border-warning/30',
  'Test drive':  'bg-accent text-accent-foreground border-accent-foreground/20',
  'Negociación': 'bg-warning-soft text-warning-foreground border-warning/30',
  'Cerrado':     'bg-success-soft text-success border-success/20',
  'Perdido':     'bg-muted text-muted-foreground border-border',
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
