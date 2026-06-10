'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import { Paginator } from '@/components/ui/paginator'
import {
  Trophy, DollarSign, Receipt, Search, X, Medal, Car, Crown,
} from 'lucide-react'
import { cn, formatCurrencyARS, parseNumeric, fmtDateShortAR } from '@/lib/utils'
import { sourceLabel, modeloLabel } from '@/lib/leads/constants'
import { getVentas } from '@/app/actions/ventas'
import { getVendedoresDelTenant } from '@/app/actions/users'

type Venta     = Awaited<ReturnType<typeof getVentas>>[number]
type Vendedor  = Awaited<ReturnType<typeof getVendedoresDelTenant>>[number]

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const PAGE_SIZE = 25
const ALL = '__all__'

interface VentasViewProps {
  ventas:         Venta[]
  vendedores:     Vendedor[]
  totalMeta:      number
  currentYear:    number
  currentMonth:   number
  canSeeVendedor: boolean
  rol:            string
}

function monto(v: Venta): number {
  return parseNumeric(v.monto) ?? 0
}

export function VentasView({
  ventas, vendedores, totalMeta, currentYear, currentMonth, canSeeVendedor, rol,
}: VentasViewProps) {
  const router = useRouter()
  const YEARS  = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // Filtros — por defecto el mes actual
  const [filterMes,  setFilterMes]  = useState<number | null>(currentMonth)
  const [filterAnio, setFilterAnio] = useState(currentYear)
  const [filterVend, setFilterVend] = useState(ALL)
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(1)
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)

  const monthLabel = filterMes !== null
    ? `${MONTHS[filterMes - 1]} ${filterAnio}`
    : `Año ${filterAnio}`

  // Ventas del período seleccionado (+ vendedor + búsqueda)
  const filtered = useMemo(() => {
    return ventas.filter((v) => {
      const d = new Date(v.vendida_at)
      if (d.getFullYear() !== filterAnio) return false
      if (filterMes !== null && d.getMonth() + 1 !== filterMes) return false
      if (filterVend !== ALL && v.vendedor_id !== filterVend) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${v.cliente ?? ''} ${v.modelo ?? ''} ${v.vendedor_alias ?? v.vendedor_nombre ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [ventas, filterAnio, filterMes, filterVend, search])

  // ── Métricas del período ──────────────────────────────────────
  const count       = filtered.length
  const montoTotal  = filtered.reduce((a, v) => a + monto(v), 0)
  const conMonto    = filtered.filter((v) => monto(v) > 0).length
  const ticketProm  = conMonto > 0 ? montoTotal / conMonto : 0
  const conUsado    = filtered.filter((v) => v.usado_marca).length

  // ── Meta del MES ACTUAL (independiente del filtro de período) ─
  const ventasMesActual = ventas.filter((v) => {
    const d = new Date(v.vendida_at)
    return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth
  }).length
  const metaPct  = totalMeta > 0 ? Math.round((ventasMesActual / totalMeta) * 100) : null
  const metaDone = totalMeta > 0 && ventasMesActual >= totalMeta

  // ── Ranking por vendedor (del período) ────────────────────────
  const ranking = useMemo(() => {
    const map = new Map<string, { nombre: string; count: number; monto: number }>()
    for (const v of filtered) {
      if (!v.vendedor_id) continue
      const key = v.vendedor_id
      const acc = map.get(key) ?? { nombre: v.vendedor_alias || v.vendedor_nombre || '—', count: 0, monto: 0 }
      acc.count += 1
      acc.monto += monto(v)
      map.set(key, acc)
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.monto - a.monto)
  }, [filtered])

  const showRanking = canSeeVendedor && ranking.length > 1

  const hasFilters = filterMes !== currentMonth || filterAnio !== currentYear || filterVend !== ALL || search.trim() !== ''
  function clearFilters() {
    setFilterMes(currentMonth); setFilterAnio(currentYear); setFilterVend(ALL); setSearch('')
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isVendedor = rol === 'vendedor'

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Trophy className="size-6 text-emerald-600" />
            Ventas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isVendedor ? 'Tus ventas concretadas' : 'Ventas concretadas del equipo'} · {monthLabel}
          </p>
        </div>
      </div>

      {/* KPIs del período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Trophy className="size-4" />}     label="Ventas del período" value={count.toString()} sub={monthLabel} accent="success" />
        <KpiCard icon={<DollarSign className="size-4" />} label="Monto total"        value={formatCurrencyARS(montoTotal)} sub={conMonto < count ? `${count - conMonto} sin monto cargado` : 'facturado'} />
        <KpiCard icon={<Receipt className="size-4" />}    label="Ticket promedio"    value={ticketProm > 0 ? formatCurrencyARS(ticketProm) : '—'} sub="por venta con monto" />
        <KpiCard icon={<Car className="size-4" />}        label="Con usado en parte de pago" value={conUsado.toString()} sub={count > 0 ? `${Math.round((conUsado / count) * 100)}% de las ventas` : '—'} />
      </div>

      {/* Meta del mes actual */}
      {metaPct !== null ? (
        <Card className={cn('p-5', metaDone && 'border-success/40 bg-success-soft/20')}>
          <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <Crown className={cn('size-4', metaDone ? 'text-success' : 'text-primary')} />
              <h3 className="font-semibold">
                {isVendedor ? 'Tu meta de' : 'Meta del equipo ·'} {MONTHS[currentMonth - 1]}
              </h3>
            </div>
            <span className="text-sm text-muted-foreground">
              <span className={cn('text-xl font-semibold', metaDone ? 'text-success' : 'text-foreground')}>{ventasMesActual}</span>
              <span className="mx-1">/</span>
              <span className="font-medium text-foreground">{totalMeta}</span> ventas
              <span className="ml-2 font-semibold text-primary">{metaPct}%</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', metaDone ? 'bg-success' : 'bg-primary')}
              style={{ width: `${Math.min(100, metaPct)}%` }}
            />
          </div>
          {!metaDone && (
            <p className="mt-2 text-xs text-muted-foreground">
              {isVendedor ? 'Te' : 'Le'} {totalMeta - ventasMesActual === 1 ? 'falta' : 'faltan'} {Math.max(0, totalMeta - ventasMesActual)} venta{totalMeta - ventasMesActual === 1 ? '' : 's'} para llegar a la meta del mes.
            </p>
          )}
        </Card>
      ) : (
        !isVendedor && (
          <Card className="p-4 text-xs text-muted-foreground flex items-center gap-2">
            <Crown className="size-4 text-muted-foreground/50 shrink-0" />
            No hay metas cargadas para {MONTHS[currentMonth - 1]}. Cargalas en Configuración → Metas para ver el cumplimiento.
          </Card>
        )
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Ranking por vendedor */}
        {showRanking && (
          <Card className="p-6 xl:col-span-1">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Medal className="size-4 text-yellow-500" />
              Ranking del período
            </h3>
            <div className="space-y-2">
              {ranking.map((r, i) => (
                <div key={r.nombre + i} className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2',
                  i === 0 ? 'bg-yellow-50 border border-yellow-200/60' : 'hover:bg-muted/40',
                )}>
                  <div className={cn(
                    'size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    i === 0 ? 'bg-yellow-400 text-yellow-900' : 'bg-muted text-muted-foreground',
                  )}>
                    {i === 0 ? <Medal className="size-3.5" /> : i + 1}
                  </div>
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">{r.nombre}</span>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{r.count} {r.count === 1 ? 'venta' : 'ventas'}</div>
                    {r.monto > 0 && <div className="text-[11px] text-muted-foreground">{formatCurrencyARS(r.monto, { compact: true })}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Tabla de ventas */}
        <Card className={cn('p-0 overflow-hidden', showRanking ? 'xl:col-span-2' : 'xl:col-span-3')}>
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
            <Select value={filterMes?.toString() ?? 'all'} onValueChange={(v) => { setFilterMes(v === 'all' ? null : Number(v)); setPage(1) }}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el año</SelectItem>
                {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterAnio.toString()} onValueChange={(v) => { setFilterAnio(Number(v)); setPage(1) }}>
              <SelectTrigger className="h-9 w-24 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, modelo..."
                className="pl-8 h-9 text-sm"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>

            {canSeeVendedor && vendedores.length > 1 && (
              <Select value={filterVend} onValueChange={(v) => { setFilterVend(v); setPage(1) }}>
                <SelectTrigger className={cn('h-9 w-auto min-w-[130px] max-w-[240px] text-sm', filterVend !== ALL && 'border-primary text-primary')}>
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los vendedores</SelectItem>
                  {vendedores.map((v) => (
                    <SelectItem key={v.user_id} value={v.user_id}>{v.alias || v.nombre || v.user_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground">
                <X className="size-3.5" />Limpiar
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="mx-auto mb-3 size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No hay ventas en este período.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-4 py-2.5 font-medium">Fecha</th>
                      <th className="px-4 py-2.5 font-medium">Cliente</th>
                      <th className="px-4 py-2.5 font-medium">Modelo</th>
                      <th className="px-4 py-2.5 font-medium text-right">Monto</th>
                      <th className="px-4 py-2.5 font-medium hidden md:table-cell">Usado</th>
                      <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Origen</th>
                      {canSeeVendedor && <th className="px-4 py-2.5 font-medium">Vendedor</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => v.lead_id && setOpenLeadId(v.lead_id)}
                        className={cn(
                          'border-b border-border/40 last:border-0 transition-colors',
                          v.lead_id ? 'hover:bg-muted/30 cursor-pointer' : '',
                        )}
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShortAR(v.vendida_at)}</td>
                        <td className="px-4 py-3 font-medium">{v.cliente ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{modeloLabel(v.modelo)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrencyARS(monto(v))}</td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs">
                          {v.usado_marca ? (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Car className="size-3 shrink-0" />
                              {v.usado_marca}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{sourceLabel(v.source, v.source_custom)}</td>
                        {canSeeVendedor && (
                          <td className="px-4 py-3 text-xs">{v.vendedor_alias || v.vendedor_nombre || '—'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3">
                <Paginator page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
              </div>
            </>
          )}
        </Card>
      </div>

      <LeadDetailSheet leadId={openLeadId} onClose={() => { setOpenLeadId(null); router.refresh() }} />
    </div>
  )
}

// ── KpiCard ───────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  accent?: 'success'
}) {
  return (
    <Card className={cn('p-5', accent === 'success' && 'border-success/30 bg-success-soft/20')}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className={cn(accent === 'success' ? 'text-success' : 'text-primary')}>{icon}</span>
      </div>
      <div className={cn('mt-3 text-2xl font-semibold tracking-tight', accent === 'success' && 'text-success')}>
        {value}
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>
    </Card>
  )
}
