'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { TrendingUp, Target, Flame, Medal } from 'lucide-react'

interface FunnelStep {
  stage: string
  count: number
  pct: number
}

interface RankingEntry {
  user_id: string
  nombre: string
  alias: string | null
  closed: number
  total: number
  conversion: number
  isMe: boolean
}

interface PerformanceViewProps {
  myActive: number
  myClosedMonth: number
  myCloseRate: number
  myAtRisk: number
  funnel: FunnelStep[]
  ranking: RankingEntry[]
}

export function PerformanceView({
  myActive,
  myClosedMonth,
  myCloseRate,
  myAtRisk,
  funnel,
  ranking,
}: PerformanceViewProps) {
  const now = new Date()
  const monthLabel = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi Performance</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            Tus métricas individuales · {monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          En vivo
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<TrendingUp className="size-4" />} label="Ventas del mes"    value={myClosedMonth.toString()} sub="leads cerrados" />
        <KpiCard icon={<Target className="size-4" />}    label="Tasa de cierre"     value={`${myCloseRate}%`}          sub="del total de tus leads" />
        <KpiCard icon={<Flame className="size-4" />}     label="Leads activos"       value={myActive.toString()}        sub={`${myAtRisk} en riesgo`} accent={myAtRisk > 0 ? 'warning' : undefined} />
        <KpiCard icon={<Target className="size-4" />}    label="Leads en riesgo"    value={myAtRisk.toString()}        sub="sin contacto +24h" accent={myAtRisk > 0 ? 'destructive' : undefined} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Funnel */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Mi embudo</h3>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.stage}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{f.stage}</span>
                  <span className="text-muted-foreground">{f.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      f.stage === 'Cerrados' ? 'bg-success' : 'bg-primary',
                    )}
                    style={{ width: `${f.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Team ranking */}
        <Card className="xl:col-span-2 p-6">
          <h3 className="font-semibold mb-4">Ranking del equipo</h3>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos de ranking este mes.</p>
          ) : (
            <div className="space-y-2">
              {ranking.map((s, i) => {
                const name = s.alias || s.nombre
                return (
                  <div
                    key={s.user_id}
                    className={cn(
                      'flex items-center gap-4 rounded-lg px-3 py-2.5',
                      s.isMe ? 'bg-primary/8 border border-primary/20' : 'hover:bg-muted/50',
                    )}
                  >
                    <div className={cn(
                      'size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                      i === 0 ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      {i === 0 ? <Medal className="size-3.5" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-sm font-medium truncate', s.isMe && 'text-primary')}>
                        {name}{s.isMe && ' (vos)'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold">{s.closed} ventas</div>
                      <div className="text-[11px] text-muted-foreground">{s.conversion}% conversión</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent?: 'destructive' | 'warning'
}) {
  return (
    <Card className={cn(
      'p-5',
      accent === 'destructive' && 'border-destructive/30 bg-destructive-soft/30',
      accent === 'warning'     && 'border-warning/30 bg-warning-soft/30',
    )}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className={cn(
          accent === 'destructive' ? 'text-destructive' :
          accent === 'warning'     ? 'text-warning-foreground' :
          'text-primary',
        )}>{icon}</span>
      </div>
      <div className={cn(
        'mt-3 text-3xl font-semibold tracking-tight',
        accent === 'destructive' && 'text-destructive',
        accent === 'warning'     && 'text-warning-foreground',
      )}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>
    </Card>
  )
}
