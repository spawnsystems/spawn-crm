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
  sellers: Seller[]
  sources: Source[]
  totalLeads: number
}

const SOURCE_COLORS: Record<string, string> = {
  'Meta Ads':      'oklch(0.65 0.16 232)',
  'Mercado Libre': 'oklch(0.72 0.18 80)',
  'Web':           'oklch(0.65 0.16 152)',
  'Referido':      'oklch(0.65 0.14 280)',
  'Walk-in':       'oklch(0.65 0.14 20)',
  'Otro':          'oklch(0.6 0.01 250)',
}

export function DashboardView({
  monthLeads,
  monthClosed,
  conversionRate,
  atRiskNow,
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
          label="Leads en riesgo"
          value={atRiskNow.toString()}
          sub="sin contacto +24h"
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

      {/* At-risk alert */}
      {atRiskNow > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="size-4 text-warning-foreground" />
            <h3 className="font-semibold">Alertas activas</h3>
          </div>
          <div className={cn(
            'rounded-lg border p-3 flex items-start gap-3',
            'border-destructive/20 bg-destructive-soft/40',
          )}>
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-destructive" />
            <div>
              <div className="text-sm font-medium">
                {atRiskNow} {atRiskNow === 1 ? 'lead en riesgo' : 'leads en riesgo'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Sin contacto en más de 24 horas
              </div>
            </div>
          </div>
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
