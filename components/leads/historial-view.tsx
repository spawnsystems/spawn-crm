'use client'

import { useState, useMemo, useTransition } from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import { Paginator } from '@/components/ui/paginator'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Archive, Search, Trophy, XCircle, ArrowUp, ArrowDown, ArrowUpDown, X,
} from 'lucide-react'
import { isBaja, statusLabel, BAJA_STATUSES } from '@/lib/leads/constants'
import { getHistorialLeads } from '@/app/actions/leads'
import { safeRefetch, toBADate } from '@/lib/utils'

type LeadRow    = Awaited<ReturnType<typeof getHistorialLeads>>[number]
type TipoFiltro = 'todos' | 'ventas' | 'bajas'
type SortKey    = 'nombre' | 'status' | 'vendedor' | 'created_at' | 'cierre_at'
type SortDir    = 'asc' | 'desc'
type FechaTipo  = 'ingreso' | 'cierre'

const PAGE_SIZE = 25

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const NOW      = new Date()
const CUR_MES  = NOW.getMonth() + 1   // 1–12
const CUR_ANIO = NOW.getFullYear()
const YEARS    = Array.from({ length: 5 }, (_, i) => CUR_ANIO - i)

function getCierreAt(lead: LeadRow): Date | null {
  const raw = lead.baja_at ?? lead.venta_at ?? null
  return raw ? new Date(raw) : null
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return format(toBADate(new Date(d as Date)), 'dd/MM/yy')
}

interface HistorialViewProps {
  initialLeads:   LeadRow[]
  canSeeVendedor: boolean
}

export function HistorialView({ initialLeads, canSeeVendedor }: HistorialViewProps) {
  const [leads,          setLeads]          = useState<LeadRow[]>(initialLeads)
  const [openLeadId,     setOpenLeadId]     = useState<string | null>(null)
  const [tipo,           setTipo]           = useState<TipoFiltro>('todos')
  const [filtroBaja,     setFiltroBaja]     = useState('todos')
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [busqueda,       setBusqueda]       = useState('')
  const [sortKey,        setSortKey]        = useState<SortKey>('cierre_at')
  const [sortDir,        setSortDir]        = useState<SortDir>('desc')
  // Filtro de período — default: mes actual, por cierre
  const [filterMes,      setFilterMes]      = useState<number | null>(CUR_MES)
  const [filterAnio,     setFilterAnio]     = useState<number>(CUR_ANIO)
  const [fechaTipo,      setFechaTipo]      = useState<FechaTipo>('cierre')
  const [page,           setPage]           = useState(1)
  const [,               startTransition]   = useTransition()

  function refresh() {
    startTransition(async () => {
      const next = await safeRefetch(() => getHistorialLeads(), 'No se pudo actualizar el historial')
      if (next) setLeads(next)
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const hasFilters = tipo !== 'todos' || filtroBaja !== 'todos'
    || filtroVendedor !== 'todos' || busqueda.trim() !== ''

  function clearFilters() {
    setTipo('todos'); setFiltroBaja('todos')
    setFiltroVendedor('todos'); setBusqueda(''); setPage(1)
  }

  const vendedores = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of leads) {
      if (l.assigned_to && !seen.has(l.assigned_to))
        seen.set(l.assigned_to, l.vendedor_alias || l.vendedor_nombre || l.assigned_to)
    }
    return Array.from(seen.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [leads])

  const filtered = useMemo(() => {
    const result = leads.filter((l) => {
      if (tipo === 'ventas' && l.status !== 'VENTA') return false
      if (tipo === 'bajas'  && !isBaja(l.status))    return false
      if (filtroBaja !== 'todos' && l.status !== filtroBaja) return false
      if (filtroVendedor !== 'todos' && l.assigned_to !== filtroVendedor) return false

      // Filtro de período
      if (filterMes !== null) {
        const d = fechaTipo === 'ingreso' ? new Date(l.created_at) : getCierreAt(l)
        if (!d) return false
        if (d.getMonth() + 1 !== filterMes || d.getFullYear() !== filterAnio) return false
      }

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        return (
          l.nombre.toLowerCase().includes(q) ||
          (l.modelo ?? '').toLowerCase().includes(q) ||
          (l.vendedor_nombre ?? '').toLowerCase().includes(q) ||
          (l.vendedor_alias  ?? '').toLowerCase().includes(q) ||
          (l.creator_nombre  ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })

    return result.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'nombre') {
        cmp = a.nombre.localeCompare(b.nombre, 'es')
      } else if (sortKey === 'status') {
        cmp = (a.status ?? '').localeCompare(b.status ?? '', 'es')
      } else if (sortKey === 'vendedor') {
        const an = (a.vendedor_alias || a.vendedor_nombre || '').toLowerCase()
        const bn = (b.vendedor_alias || b.vendedor_nombre || '').toLowerCase()
        if (!an && bn)  return sortDir === 'asc' ?  1 : -1
        if (an  && !bn) return sortDir === 'asc' ? -1 :  1
        cmp = an.localeCompare(bn, 'es')
      } else if (sortKey === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortKey === 'cierre_at') {
        const at = getCierreAt(a)?.getTime() ?? null
        const bt = getCierreAt(b)?.getTime() ?? null
        if (at === null && bt === null) return 0
        if (at === null) return sortDir === 'asc' ?  1 : -1
        if (bt === null) return sortDir === 'asc' ? -1 :  1
        cmp = at - bt
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, tipo, filtroBaja, filtroVendedor, busqueda, filterMes, filterAnio, fechaTipo, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const ventasCount = leads.filter((l) => l.status === 'VENTA').length
  const bajasCount  = leads.filter((l) => isBaja(l.status)).length

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Archive className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Historial de leads</h1>
        </div>
        <p className="text-sm text-muted-foreground">Leads cerrados como venta y leads dados de baja.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Trophy className="size-3.5 text-emerald-600" />Ventas
          </div>
          <p className="text-2xl font-semibold text-emerald-600">{ventasCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <XCircle className="size-3.5 text-rose-500" />Bajas
          </div>
          <p className="text-2xl font-semibold text-rose-500">{bajasCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 col-span-2 sm:col-span-1">
          <div className="text-xs text-muted-foreground mb-1">Total</div>
          <p className="text-2xl font-semibold">{leads.length}</p>
        </div>
      </div>

      {/* ── Filtros (período + texto + tipo) en una sola fila ─────── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Toggle ingreso / cierre */}
        <div className="flex h-8 rounded-md border border-input text-xs overflow-hidden shrink-0">
          <button
            onClick={() => { setFechaTipo('ingreso'); setPage(1) }}
            className={cn(
              'px-3 transition-colors',
              fechaTipo === 'ingreso'
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >Ingreso</button>
          <button
            onClick={() => { setFechaTipo('cierre'); setPage(1) }}
            className={cn(
              'px-3 border-l border-input transition-colors',
              fechaTipo === 'cierre'
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >Cierre</button>
        </div>

        {/* Mes */}
        <Select
          value={filterMes?.toString() ?? 'all'}
          onValueChange={(v) => { setFilterMes(v === 'all' ? null : Number(v)); setPage(1) }}
        >
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los meses</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Año — solo cuando hay mes seleccionado */}
        {filterMes !== null && (
          <Select
            value={filterAnio.toString()}
            onValueChange={(v) => { setFilterAnio(Number(v)); setPage(1) }}
          >
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre, modelo, originado..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoFiltro); setFiltroBaja('todos'); setPage(1) }}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ventas">Solo ventas</SelectItem>
            <SelectItem value="bajas">Solo bajas</SelectItem>
          </SelectContent>
        </Select>

        {tipo === 'bajas' && (
          <Select value={filtroBaja} onValueChange={(v) => { setFiltroBaja(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Motivo de baja..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los motivos</SelectItem>
              {[...BAJA_STATUSES].map((s) => (
                <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {canSeeVendedor && vendedores.length > 0 && (
          <Select value={filtroVendedor} onValueChange={(v) => { setFiltroVendedor(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Todos los vendedores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vendedores</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 gap-1 text-muted-foreground text-xs">
            <X className="size-3" />Limpiar
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <Paginator page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} className="mb-4" />

      {filtered.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-xl">
          <Archive className="size-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay leads que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[750px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <SortableTh label="Lead"        col="nombre"     sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Modelo</th>
                <SortableTh label="Estado"      col="status"     sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                {canSeeVendedor && (
                  <SortableTh label="Vendedor"  col="vendedor"   sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} className="hidden md:table-cell" />
                )}
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Originado por</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Motivo</th>
                <SortableTh label="Ingreso"     col="created_at" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortableTh label="Cierre"      col="cierre_at"  sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.map((lead) => {
                const vendorName = lead.vendedor_alias || lead.vendedor_nombre
                const cierreAt   = getCierreAt(lead)
                return (
                  <tr key={lead.id} onClick={() => setOpenLeadId(lead.id)} className="hover:bg-muted/30 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <span className={cn('font-medium', isBaja(lead.status) && 'text-muted-foreground')}>
                        {lead.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{lead.modelo ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    {canSeeVendedor && (
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{vendorName ?? '—'}</td>
                    )}
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{lead.creator_nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground italic hidden lg:table-cell max-w-xs truncate">{lead.baja_motivo ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(lead.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(cierreAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paginator page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} className="mt-4" />

      <LeadDetailSheet leadId={openLeadId} onClose={() => { setOpenLeadId(null); refresh() }} />
    </div>
  )
}

function SortableTh({ label, col, sortKey, sortDir, onToggle, className }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir
  onToggle: (col: SortKey) => void; className?: string
}) {
  const active = sortKey === col
  return (
    <th className={cn('px-4 py-2.5 font-medium text-left cursor-pointer select-none whitespace-nowrap group', className)} onClick={() => onToggle(col)}>
      <span className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {active
          ? sortDir === 'asc' ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
          : <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
      </span>
    </th>
  )
}
