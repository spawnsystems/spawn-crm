'use client'

import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  TrendingUp, Target, AlertOctagon, Bell, AlertTriangle, Timer, Zap, Trophy,
} from 'lucide-react'
import type { AttentionSummary } from '@/app/actions/leads'

interface Seller {
  nombre: string
  alias: string | null
  total: number
  closed: number
  atRisk: number
  conversion: number
  contacted: number
  contactRate: number
  avgRespMin: number | null
  meta: number
  metaPct: number | null
}

interface Source {
  name: string
  count: number
  closed: number
  conversion: number
  share: number
}

interface ResponseTime {
  avgMin: number | null
  medianMin: number | null
  contacted: number
  sinContactar: number
  total: number
  buckets: { label: string; count: number; pct: number }[]
}

interface MetaCumplimiento {
  closed: number
  meta: number
  pct: number | null
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
  responseTime: ResponseTime
  metaCumplimiento: MetaCumplimiento
}

const SOURCE_COLORS: Record<string, string> = {
  'Meta Ads':        'oklch(0.65 0.16 232)',
  'Mercado Libre':   'oklch(0.72 0.18 80)',
  'Sitio web':       'oklch(0.65 0.16 152)',
  'Referido':        'oklch(0.65 0.14 280)',
  'Visita al local': 'oklch(0.65 0.14 20)',
  'Contacto directo':'oklch(0.65 0.16 60)',
  'Dato viejo':      'oklch(0.6 0.08 200)',
  'Otro':            'oklch(0.6 0.01 250)',
}

const BUCKET_COLORS = [
  'oklch(0.7 0.17 152)',  // ≤15m — verde
  'oklch(0.78 0.15 145)', // ≤1h
  'oklch(0.8 0.15 85)',   // ≤24h — ámbar
  'oklch(0.65 0.2 25)',   // +24h — rojo
  'oklch(0.7 0.02 250)',  // sin contactar — gris
]

// minutos → "12m" · "3h 20m" · "2d 4h"
function fmtDuration(min: number | null): string {
  if (min === null) return '—'
  if (min < 1) return '<1m'
  if (min < 60) return `${min}m`
  if (min < 1440) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  return h > 0 ? `${d}d ${h}h` : `${d}d`
}

// color del tiempo de respuesta según rapidez (semáforo)
function respColor(min: number | null): string {
  if (min === null) return 'text-muted-foreground'
  if (min <= 60) return 'text-success'
  if (min <= 1440) return 'text-amber-600'
  return 'text-destructive'
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
  responseTime,
  metaCumplimiento,
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
          icon={<Timer className="size-4" />}
          label="Tiempo de respuesta"
          value={fmtDuration(responseTime.medianMin)}
          sub={
            responseTime.avgMin !== null
              ? `mediana · prom. ${fmtDuration(responseTime.avgMin)}`
              : 'sin contactos aún'
          }
        />
        <KpiCard
          icon={<AlertOctagon className="size-4" />}
          label="Requieren atención"
          value={atRiskNow.toString()}
          sub="colgados o con acción vencida"
          accent={atRiskNow > 0 ? 'destructive' : undefined}
        />
      </div>

      {/* Salud de la cartera — dos lentes independientes (alcance + momentum) */}
      {(attention.sinContactar > 0 || attention.colgados > 0) && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Salud de la cartera</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Alcance */}
            <div className={cn('rounded-lg border p-4',
              attention.sinContactarVencido > 0 ? 'border-destructive/20 bg-destructive-soft/30' : 'border-border')}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sin contactar</span>
                <AlertTriangle className={cn('size-4', attention.sinContactarVencido > 0 ? 'text-destructive' : 'text-muted-foreground')} />
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{attention.sinContactar}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                leads que aún no se lograron contactar
                {attention.sinContactarVencido > 0 && (
                  <> · <span className="font-medium text-destructive">{attention.sinContactarVencido} pasaron el plazo</span></>
                )}
              </p>
            </div>

            {/* Momentum */}
            <div className={cn('rounded-lg border p-4',
              attention.colgados > 0 ? 'border-amber-200/70 bg-amber-50' : 'border-border')}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Colgados</span>
                <AlertOctagon className={cn('size-4', attention.colgados > 0 ? 'text-amber-600' : 'text-muted-foreground')} />
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{attention.colgados}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                ya contactados pero sin próximo paso agendado
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cumplimiento de meta del equipo */}
      {metaCumplimiento.pct !== null ? (
        <Card className={cn('p-5', metaCumplimiento.closed >= metaCumplimiento.meta && 'border-success/40 bg-success-soft/20')}>
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <Trophy className={cn('size-4', metaCumplimiento.closed >= metaCumplimiento.meta ? 'text-success' : 'text-primary')} />
              <h3 className="font-semibold">Cumplimiento de meta del equipo</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              <span className={cn('text-xl font-semibold', metaCumplimiento.closed >= metaCumplimiento.meta ? 'text-success' : 'text-foreground')}>
                {metaCumplimiento.closed}
              </span>
              <span className="mx-1">/</span>
              <span className="font-medium text-foreground">{metaCumplimiento.meta}</span> ventas
              <span className="ml-2 font-semibold text-primary">{metaCumplimiento.pct}%</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', metaCumplimiento.closed >= metaCumplimiento.meta ? 'bg-success' : 'bg-primary')}
              style={{ width: `${Math.min(100, metaCumplimiento.pct)}%` }}
            />
          </div>
        </Card>
      ) : (
        <Card className="p-4 text-xs text-muted-foreground flex items-center gap-2">
          <Trophy className="size-4 text-muted-foreground/50 shrink-0" />
          No hay metas cargadas para este mes. Cargalas en Configuración → Metas para ver el cumplimiento del equipo.
        </Card>
      )}

      {/* Conversión por origen + Tiempo de respuesta */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Conversión por origen */}
        <Card className="xl:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Conversión por origen</h3>
            <span className="text-xs text-muted-foreground">leads · ventas · conversión</span>
          </div>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos este mes.</p>
          ) : (
            <div className="space-y-3.5">
              {sources.map((s) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="size-2.5 rounded-sm shrink-0"
                        style={{ background: SOURCE_COLORS[s.name] ?? 'oklch(0.65 0.14 250)' }}
                      />
                      {s.name}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {s.count} leads · <span className="font-medium text-foreground">{s.closed} ventas</span>
                      <span className={cn(
                        'ml-2 font-semibold',
                        s.conversion >= 20 ? 'text-success'
                        : s.conversion >= 8 ? 'text-amber-600'
                        : 'text-muted-foreground',
                      )}>{s.conversion}%</span>
                    </span>
                  </div>
                  {/* barra de volumen con relleno de conversión */}
                  <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                    <div
                      className="h-full rounded-full opacity-25"
                      style={{ width: `${s.share}%`, background: SOURCE_COLORS[s.name] ?? 'oklch(0.65 0.14 250)' }}
                    />
                    <div
                      className="h-full rounded-full absolute top-0 left-0"
                      style={{
                        width: `${Math.round((s.share * s.conversion) / 100)}%`,
                        background: SOURCE_COLORS[s.name] ?? 'oklch(0.65 0.14 250)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground">
            Total del mes: <span className="font-semibold text-foreground">{totalLeads} leads</span>
            <span className="mx-1.5">·</span>
            barra clara = volumen · barra sólida = porción convertida
          </div>
        </Card>

        {/* Tiempo de respuesta — distribución */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="size-4 text-primary" />
            <h3 className="font-semibold">Tiempo de respuesta</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Desde que ingresa el lead hasta el primer contacto del vendedor.
          </p>

          {responseTime.total === 0 ? (
            <p className="text-sm text-muted-foreground">Sin leads este mes.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-3 mb-4">
                <div>
                  <div className={cn('text-2xl font-semibold tracking-tight', respColor(responseTime.medianMin))}>
                    {fmtDuration(responseTime.medianMin)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">mediana</div>
                </div>
                <div className="text-muted-foreground/30 text-xl">·</div>
                <div>
                  <div className="text-lg font-medium text-muted-foreground">
                    {fmtDuration(responseTime.avgMin)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">promedio</div>
                </div>
              </div>

              <div className="space-y-2.5">
                {responseTime.buckets.map((b, i) => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={cn(b.label === 'Sin contactar' && 'text-muted-foreground')}>
                        {b.label}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {b.count} <span className="text-muted-foreground/60">({b.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${b.pct}%`, background: BUCKET_COLORS[i] ?? 'oklch(0.65 0.14 250)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Detalle por vendedor */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Detalle por vendedor</h3>
          <span className="text-xs text-muted-foreground">este mes</span>
        </div>
        {sellers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Vendedor</th>
                  <th className="pb-2 font-medium text-center">Leads</th>
                  <th className="pb-2 font-medium text-center">Contactó</th>
                  <th className="pb-2 font-medium text-center">T. respuesta</th>
                  <th className="pb-2 font-medium text-center">Ventas</th>
                  <th className="pb-2 font-medium text-center">Meta</th>
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
                      <td className="text-center text-muted-foreground tabular-nums">{s.total}</td>
                      <td className="text-center tabular-nums">
                        <span className="font-medium">{s.contacted}</span>
                        <span className="text-muted-foreground/60 text-xs"> · {s.contactRate}%</span>
                      </td>
                      <td className={cn('text-center font-medium tabular-nums', respColor(s.avgRespMin))}>
                        {fmtDuration(s.avgRespMin)}
                      </td>
                      <td className="text-center font-semibold tabular-nums">{s.closed}</td>
                      <td className="text-center tabular-nums">
                        {s.meta > 0 ? (
                          <span>
                            <span className="font-medium">{s.closed}/{s.meta}</span>
                            <span className={cn(
                              'ml-1.5 text-xs font-semibold',
                              (s.metaPct ?? 0) >= 100 ? 'text-success'
                              : (s.metaPct ?? 0) >= 60 ? 'text-amber-600'
                              : 'text-muted-foreground',
                            )}>{s.metaPct}%</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {s.atRisk > 0 ? (
                          <span className="text-destructive font-medium tabular-nums">{s.atRisk}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={s.conversion} className="h-1.5 w-20" />
                          <span className="text-xs font-medium w-10 tabular-nums">{s.conversion}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-muted-foreground">
              T. respuesta = promedio del tiempo hasta el primer contacto de los leads que el vendedor ya contactó.
            </p>
          </div>
        )}
      </Card>

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
