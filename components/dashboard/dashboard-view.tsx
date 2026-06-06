'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  TrendingUp, Target, AlertOctagon, ArrowUp, ArrowDown, Bell, AlertTriangle,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { AttentionSummary } from '@/app/actions/leads'

interface Seller {
  nombre: string
  alias: string | null
  total: number
  closed: number
  atRisk: number
  conversion: number
}

interface Source {
  name: string
  value: number
  count: number
}

interface DashboardViewProps {
  monthLeads: number
  monthClosed: number
  conversionRate: number
  atRiskNow: number
  attention: AttentionSummary
  sellers: Seller[]
  sources: Source[]
  totalLeads: number
}

const SOURCE_COLORS: Record<string, string> = {
  'Meta Ads':        'oklch(0.65 0.16 232)',
  'Mercado Libre':   'oklch(0.72 0.18 80)',
  'Sitio web':       'oklch(0.65 0.16 152)',
  'Referido':        'oklch(0.65 0.14 280)',
  'Visita al local': 'oklch(0.65 0.14 20)',
  'Contacto directo':'oklch(0.65 0.16 60)',
  'Otro':            'oklch(0.6 0.01 250)',
}

export function DashboardView({
  monthLeads,
  monthClosed,
  conversionRate,
  atRiskNow,
  attention,
  sellers,
  sources,
  totalLeads,
}: DashboardViewProps) {
  const now = new Date()
  const monthLabel = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            Resumen general · {monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          En vivo
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Leads del mes"
          value={monthLeads.toString()}
          sub="recibidos este mes"
        />
        <KpiCard
          icon={<Target className="size-4" />}
          label="Tasa de conversión"
          value={`${conversionRate}%`}
          sub={`${monthClosed} cerrados de ${monthLeads} leads`}
        />
        <KpiCard
          icon={<TrendingUp className="size-4" />}
          label="Ventas del mes"
          value={monthClosed.toString()}
          sub="leads cerrados"
        />
        <KpiCard
          icon={<AlertOctagon className="size-4" />}
          label="Requieren atención"
          value={atRiskNow.toString()}
          sub="colgados o con acción vencida"
          accent={atRiskNow > 0 ? 'destructive' : undefined}
        />
      </div>

      {/* Two-column row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Sellers table */}
        <Card className="xl:col-span-2 p-6">
          <h3 className="font-semibold mb-4">Performance por vendedor</h3>
          {sellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Vendedor</th>
                    <th className="pb-2 font-medium text-center">Total</th>
                    <th className="pb-2 font-medium text-center">Cerr.</th>
                    <th className="pb-2 font-medium text-center">Riesgo</th>
                    <th className="pb-2 font-medium">Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s) => {
                    const name = s.alias || s.nombre
                    const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
                    return (
                      <tr key={s.nombre} className="border-b border-border/50 last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary text-[11px] font-semibold">
                              {initials}
                            </div>
                            <span className="font-medium">{name}</span>
                          </div>
                        </td>
                        <td className="text-center text-muted-foreground">{s.total}</td>
                        <td className="text-center font-semibold">{s.closed}</td>
                        <td className="text-center">
                          {s.atRisk > 0 ? (
                            <span className="text-destructive font-medium">{s.atRisk}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Progress value={s.conversion} className="h-1.5 w-20" />
                            <span className="text-xs font-medium w-10">{s.conversion}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Sources */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Origen de leads</h3>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <div className="space-y-3">
              {sources.map((s) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground">{s.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.value}%`,
                        background: SOURCE_COLORS[s.name] ?? 'oklch(0.65 0.14 250)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground">
            Total: <span className="font-semibold text-foreground">{totalLeads} leads</span>
          </div>
        </Card>
      </div>

      {/* Panel de atención — leads colgados o con acción vencida */}
      {attention.total > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="size-4 text-warning-foreground" />
            <h3 className="font-semibold">Requieren atención</h3>
            <span className="text-xs text-muted-foreground">
              · {attention.total} {attention.total === 1 ? 'lead' : 'leads'} del equipo
            </span>
          </div>

          {/* Desglose por tipo de alerta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {attention.byType.map((t) => (
              <div
                key={t.type}
                className={cn(
                  'rounded-lg border p-3',
                  t.severity === 'alta'
                    ? 'border-destructive/20 bg-destructive-soft/40'
                    : 'border-amber-200/70 bg-amber-50',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className={cn('size-3.5 shrink-0',
                    t.severity === 'alta' ? 'text-destructive' : 'text-amber-600')} />
                  <span className={cn('text-lg font-semibold',
                    t.severity === 'alta' ? 'text-destructive' : 'text-amber-700')}>
                    {t.count}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
              </div>
            ))}
          </div>

          {/* Por vendedor */}
          {attention.bySeller.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Por vendedor</div>
              <div className="flex flex-wrap gap-2">
                {attention.bySeller.map((s) => (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className={cn('font-semibold', s.alta > 0 ? 'text-destructive' : 'text-amber-700')}>
                      {s.count}
                    </span>
                    {s.alta > 0 && (
                      <span className="text-[10px] text-destructive/70">({s.alta} urgente{s.alta === 1 ? '' : 's'})</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent?: 'destructive'
}) {
  return (
    <Card className={cn('p-5', accent === 'destructive' && 'border-destructive/30 bg-destructive-soft/30')}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className={cn(accent === 'destructive' ? 'text-destructive' : 'text-primary')}>{icon}</span>
      </div>
      <div className={cn('mt-3 text-3xl font-semibold tracking-tight', accent === 'destructive' && 'text-destructive')}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>
    </Card>
  )
}
