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

type LeadRow  = Awaited<ReturnType<typeof getHistorialLeads>>[number]
type TipoFiltro = 'todos' | 'ventas' | 'bajas'
type SortKey  = 'nombre' | 'status' | 'vendedor' | 'created_at' | 'cierre_at'
type SortDir  = 'asc' | 'desc'

const PAGE_SIZE = 25

// Fecha de cierre: baja_at para bajas, venta_at para ventas
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
  const [leads,             setLeads]             = useState<LeadRow[]>(initialLeads)
  const [openLeadId,        setOpenLeadId]        = useState<string | null>(null)
  const [tipo,              setTipo]              = useState<TipoFiltro>('todos')
  const [filtroBaja,        setFiltroBaja]        = useState<string>('todos')
  const [filtroVendedor,    setFiltroVendedor]    = useState<string>('todos')
  const [busqueda,          setBusqueda]          = useState('')
  const [sortKey,           setSortKey]           = useState<SortKey>('cierre_at')
  const [sortDir,           setSortDir]           = useState<SortDir>('desc')
  const [ingresoDesde,      setIngresoDesde]      = useState('')
  const [ingresoHasta,      setIngresoHasta]      = useState('')
  const [cierreDesde,       setCierreDesde]       = useState('')
  const [cierreHasta,       setCierreHasta]       = useState('')
  const [page,              setPage]              = useState(1)
  const [,                  startTransition]      = useTransition()

  function refresh() {
    startTransition(async () => {
      const next = await safeRefetch(() => getHistorialLeads(), 'No se pudo actualizar el historial')
      if (next) setLeads(next)
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  function clearFilters() {
    setTipo('todos')
    setFiltroBaja('todos')
    setFiltroVendedor('todos')
    setBusqueda('')
    setIngresoDesde('')
    setIngresoHasta('')
    setCierreDesde('')
    setCierreHasta('')
    setPage(1)
  }

  const hasFilters = tipo !== 'todos' || filtroBaja !== 'todos' || filtroVendedor !== 'todos'
    || busqueda.trim() !== '' || ingresoDesde !== '' || ingresoHasta !== ''
    || cierreDesde !== '' || cierreHasta !== ''

  // Vendedores únicos para el filtro
  const vendedores = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of leads) {
      if (l.assigned_to && !seen.has(l.assigned_to)) {
        seen.set(l.assigned_to, l.vendedor_alias || l.vendedor_nombre || l.assigned_to)
      }
    }
    return Array.from(seen.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [leads])

  const filtered = useMemo(() => {
    const result = leads.filter((l) => {
      if (tipo === 'ventas' && l.status !== 'VENTA') return false
      if (tipo === 'bajas'  && !isBaja(l.status))    return false
      if (filtroBaja !== 'todos' && l.status !== filtroBaja) return false
      if (filtroVendedor !== 'todos' && l.assigned_to !== filtroVendedor) return false

      // Filtro de fecha de ingreso
      if (ingresoDesde) {
        const desde = new Date(ingresoDesde + 'T00:00:00')
        if (new Date(l.created_at) < desde) return false
      }
      if (ingresoHasta) {
        const hasta = new Date(ingresoHasta + 'T23:59:59')
        if (new Date(l.created_at) > hasta) return false
      }

      // Filtro de fecha de cierre
      if (cierreDesde || cierreHasta) {
        const cierreAt = getCierreAt(l)
        if (!cierreAt) return false
        if (cierreDesde) {
          const desde = new Date(cierreDesde + 'T00:00:00')
          if (cierreAt < desde) return false
        }
        if (cierreHasta) {
          const hasta = new Date(cierreHasta + 'T23:59:59')
          if (cierreAt > hasta) return false
        }
      }

      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        return (
          l.nombre.toLowerCase().includes(q) ||
          (l.modelo ?? '').toLowerCase().includes(q) ||
          (l.vendedor_nombre ?? '').toLowerCase().includes(q) ||
          (l.vendedor_alias  ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })

    // Orden
    return result.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'nombre') {
        cmp = a.nombre.localeCompare(b.nombre, 'es')
      } else if (sortKey === 'status') {
        cmp = (a.status ?? '').localeCompare(b.status ?? '', 'es')
      } else if (sortKey === 'vendedor') {
        const aName = (a.vendedor_alias || a.vendedor_nombre || '').toLowerCase()
        const bName = (b.vendedor_alias || b.vendedor_nombre || '').toLowerCase()
        if (!aName && bName)  return sortDir === 'asc' ? 1 : -1
        if (aName  && !bName) return sortDir === 'asc' ? -1 : 1
        cmp = aName.localeCompare(bName, 'es')
      } else if (sortKey === 'created_at') {
        const aT = new Date(a.created_at).getTime()
        const bT = new Date(b.created_at).getTime()
        cmp = aT - bT
      } else if (sortKey === 'cierre_at') {
        const aT = getCierreAt(a)?.getTime() ?? null
        const bT = getCierreAt(b)?.getTime() ?? null
        if (aT === null && bT === null) return 0
        if (aT === null) return sortDir === 'asc' ? 1 : -1
        if (bT === null) return sortDir === 'asc' ? -1 : 1
        cmp = aT - bT
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, tipo, filtroBaja, filtroVendedor, busqueda, ingresoDesde, ingresoHasta, cierreDesde, cierreHasta, sortKey, sortDir])

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
        <p className="text-sm text-muted-foreground">
          Leads cerrados como venta y leads dados de baja.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Trophy className="size-3.5 text-emerald-600" />
            Ventas
          </div>
          <p className="text-2xl font-semibold text-emerald-600">{ventasCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <XCircle className="size-3.5 text-rose-500" />
            Bajas
          </div>
          <p className="text-2xl font-semibold text-rose-500">{bajasCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 col-span-2 sm:col-span-1">
          <div className="text-xs text-muted-foreground mb-1">Total</div>
          <p className="text-2xl font-semibold">{leads.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, modelo..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Tipo */}
        <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoFiltro); setFiltroBaja('todos'); setPage(1) }}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ventas">Solo ventas</SelectItem>
            <SelectItem value="bajas">Solo bajas</SelectItem>
          </SelectContent>
        </Select>

        {/* Sub-filtro de baja */}
        {tipo === 'bajas' && (
          <Select value={filtroBaja} onValueChange={(v) => { setFiltroBaja(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Motivo de baja..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los motivos</SelectItem>
              {[...BAJA_STATUSES].map((s) => (
                <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro por vendedor */}
        {canSeeVendedor && vendedores.length > 0 && (
          <Select value={filtroVendedor} onValueChange={(v) => { setFiltroVendedor(v); setPage(1) }}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Todos los vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vendedores</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Limpiar filtros */}
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 gap-1 text-muted-foreground text-xs">
            <X className="size-3" />Limpiar
          </Button>
        )}
      </div>

      {/* Filtros de fecha */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-medium shrink-0">Ingreso:</span>
          <input
            type="date"
            value={ingresoDesde}
            onChange={(e) => { setIngresoDesde(e.target.value); setPage(1) }}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="shrink-0">—</span>
          <input
            type="date"
            value={ingresoHasta}
            onChange={(e) => { setIngresoHasta(e.target.value); setPage(1) }}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium shrink-0">Cierre:</span>
          <input
            type="date"
            value={cierreDesde}
            onChange={(e) => { setCierreDesde(e.target.value); setPage(1) }}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="shrink-0">—</span>
          <input
            type="date"
            value={cierreHasta}
            onChange={(e) => { setCierreHasta(e.target.value); setPage(1) }}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Contador + paginación */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <Paginator
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="mb-4"
      />

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-xl">
          <Archive className="size-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay leads que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <SortableTh label="Lead"          col="nombre"     sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Modelo</th>
                <SortableTh label="Estado"        col="status"     sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                {canSeeVendedor && (
                  <SortableTh label="Vendedor"    col="vendedor"   sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} className="hidden md:table-cell" />
                )}
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Motivo</th>
                <SortableTh label="Ingreso"       col="created_at" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortableTh label="Cierre"        col="cierre_at"  sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.map((lead) => {
                const vendorName = lead.vendedor_alias || lead.vendedor_nombre
                const cierreAt   = getCierreAt(lead)
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setOpenLeadId(lead.id)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={cn('font-medium', isBaja(lead.status) && 'text-muted-foreground')}>
                        {lead.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {lead.modelo ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    {canSeeVendedor && (
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {vendorName ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground italic hidden lg:table-cell max-w-xs truncate">
                      {lead.baja_motivo ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(lead.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(cierreAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Paginator
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="mt-4"
      />

      <LeadDetailSheet
        leadId={openLeadId}
        onClose={() => { setOpenLeadId(null); refresh() }}
      />
    </div>
  )
}

// ── SortableTh ────────────────────────────────────────────────

function SortableTh({
  label, col, sortKey, sortDir, onToggle, className,
}: {
  label:    string
  col:      SortKey
  sortKey:  SortKey
  sortDir:  SortDir
  onToggle: (col: SortKey) => void
  className?: string
}) {
  const active = sortKey === col
  return (
    <th
      className={cn('px-4 py-2.5 font-medium text-left cursor-pointer select-none whitespace-nowrap group', className)}
      onClick={() => onToggle(col)}
    >
      <span className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        {active ? (
          sortDir === 'asc'
            ? <ArrowUp   className="size-3 text-primary" />
            : <ArrowDown className="size-3 text-primary" />
        ) : (
          <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        )}
      </span>
    </th>
  )
}
