'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Trophy, Medal, Clock } from 'lucide-react'

interface RankingEntry {
  user_id: string
  nombre: string
  alias: string | null
  closed: number
  total: number
  atRisk: number
  conversion: number
}

interface TeamViewProps {
  ranking: RankingEntry[]
}

const MEDAL_COLORS = [
  'bg-yellow-400 text-yellow-900',
  'bg-slate-300 text-slate-700',
  'bg-orange-400 text-orange-900',
]

export function TeamView({ ranking }: TeamViewProps) {
  const maxClosed = ranking[0]?.closed ?? 1
  const now = new Date()
  const monthLabel = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">Ranking por ventas · {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Trophy className="size-4 text-warning-foreground" />
          <span>{ranking.length} vendedores activos</span>
        </div>
      </div>

      {ranking.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin datos de ranking este mes.</p>
      )}

      {/* Podio top 3 */}
      {ranking.length >= 2 && (
        <div className="flex items-end justify-center gap-4 mb-8">
          {ranking[1] && <PodiumCard seller={ranking[1]} position={2} />}
          {ranking[0] && <PodiumCard seller={ranking[0]} position={1} featured />}
          {ranking[2] && <PodiumCard seller={ranking[2]} position={3} />}
        </div>
      )}

      {/* Resto del ranking (posición 4+) */}
      {ranking.length > 3 && (
        <div className="space-y-2">
          {ranking.slice(3).map((s, i) => {
            const name = s.alias || s.nombre
            const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
            return (
              <Card key={s.user_id} className="px-5 py-4 flex items-center gap-5">
                <div className="size-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 4}
                </div>
                <div className="size-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{name}</div>
                  <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-success" />
                    {s.atRisk > 0 ? <span className="text-destructive">{s.atRisk} en riesgo</span> : 'Al día'}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm shrink-0">
                  <Metric label="Ventas" value={`${s.closed}`} highlight />
                  <Metric label="Conversión" value={`${s.conversion}%`} />
                  <Metric label="Total" value={`${s.total}`} />
                </div>
                <div className="w-28 shrink-0">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Ventas</span>
                    <span>{s.closed}/{maxClosed}</span>
                  </div>
                  <Progress value={(s.closed / maxClosed) * 100} className="h-1.5" />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PodiumCard({ seller: s, position, featured }: {
  seller: RankingEntry
  position: number
  featured?: boolean
}) {
  const name = s.alias || s.nombre
  const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <Card className={cn(
      'flex flex-col items-center text-center transition-shadow',
      featured ? 'px-8 py-6 shadow-elevated w-56' : 'px-6 py-5 w-44',
    )}>
      <div className={cn(
        'flex items-center justify-center rounded-full font-bold mb-3',
        featured ? 'size-10 text-base' : 'size-8 text-sm',
        MEDAL_COLORS[position - 1] ?? 'bg-muted text-muted-foreground',
      )}>
        {position === 1 ? <Medal className={featured ? 'size-5' : 'size-4'} /> : position}
      </div>

      <div className={cn(
        'rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-semibold mb-3',
        featured ? 'size-14 text-lg' : 'size-11 text-sm',
      )}>
        {initials}
      </div>

      <div className={cn('font-semibold leading-tight', featured ? 'text-base' : 'text-sm')}>
        {name}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5 mb-3">
        {s.atRisk > 0
          ? <span className="text-destructive">{s.atRisk} en riesgo</span>
          : 'Al día'}
      </div>

      <div className={cn('font-bold text-primary', featured ? 'text-4xl' : 'text-3xl')}>
        {s.closed}
      </div>
      <div className="text-xs text-muted-foreground mb-3">ventas del mes</div>

      <div className="w-full border-t border-border pt-3 grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="text-xs font-semibold">{s.conversion}%</div>
          <div className="text-[10px] text-muted-foreground">conversión</div>
        </div>
        <div>
          <div className="text-xs font-semibold">{s.total}</div>
          <div className="text-[10px] text-muted-foreground">leads</div>
        </div>
      </div>
    </Card>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={cn('font-semibold', highlight && 'text-primary')}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
