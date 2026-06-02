'use client'

import { useState, useMemo, useTransition } from 'react'
import { cn, formatCurrencyARS } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import { Paginator } from '@/components/ui/paginator'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Archive, Search, Trophy, XCircle } from 'lucide-react'
import { isBaja, statusLabel, BAJA_STATUSES } from '@/lib/leads/constants'
import { getHistorialLeads } from '@/app/actions/leads'
import { safeRefetch } from '@/lib/utils'

type LeadRow = Awaited<ReturnType<typeof getHistorialLeads>>[number]

type TipoFiltro = 'todos' | 'ventas' | 'bajas'

const PAGE_SIZE = 25

interface HistorialViewProps {
  initialLeads: LeadRow[]
  canSeeVendedor: boolean   // supervisor+ puede filtrar por vendedor
}

export function HistorialView({ initialLeads, canSeeVendedor }: HistorialViewProps) {
  const [leads,         setLeads]         = useState<LeadRow[]>(initialLeads)
  const [openLeadId,    setOpenLeadId]    = useState<string | null>(null)
  const [tipo,          setTipo]          = useState<TipoFiltro>('todos')
  const [filtroBaja,    setFiltroBaja]    = useState<string>('todos')
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos')
  const [busqueda,      setBusqueda]      = useState('')
  const [page,          setPage]          = useState(1)
  const [,              startTransition]  = useTransition()

  function refresh() {
    startTransition(async () => {
      const next = await safeRefetch(() => getHistorialLeads(), 'No se pudo actualizar el historial')
      if (next) setLeads(next)
    })
  }

  // ── Vendedores únicos para el filtro ─────────────────────────
  const vendedores = useMemo(() => {
    const seen = new Map<string, string>()
    for (const l of leads) {
      if (l.assigned_to && !seen.has(l.assigned_to)) {
        seen.set(l.assigned_to, l.vendedor_alias || l.vendedor_nombre || l.assigned_to)
      }
    }
    return Array.from(seen.entries()).map(([id, nombre]) => ({ id, nombre }))
  }, [leads])

  // ── Filtrado ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (tipo === 'ventas' && l.status !== 'VENTA') return false
      if (tipo === 'bajas'  && !isBaja(l.status))    return false
      if (filtroBaja !== 'todos' && l.status !== filtroBaja) return false
      if (filtroVendedor !== 'todos' && l.assigned_to !== filtroVendedor) return false
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
  }, [leads, tipo, filtroBaja, filtroVendedor, busqueda])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const ventasCount = leads.filter((l) => l.status === 'VENTA').length
  const bajasCount  = leads.filter((l) => isBaja(l.status)).length

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">

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

      {/* KPIs rápidos */}
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
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, modelo..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPage(1) }}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Tipo: todos / ventas / bajas */}
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

        {/* Sub-filtro de baja (solo visible cuando tipo=bajas) */}
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

        {/* Filtro por vendedor (solo supervisor+) */}
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
      </div>

      {/* Contador y paginación superior */}
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
          <p className="text-sm text-muted-foreground">No hay leads en el historial.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-medium">Lead</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Modelo</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                {canSeeVendedor && (
                  <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Vendedor</th>
                )}
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.map((lead) => {
                const vendorName = lead.vendedor_alias || lead.vendedor_nombre
                return (
                  <tr
                    key={lead.id}
                    onClick={() => setOpenLeadId(lead.id)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={cn(
                        'font-medium',
                        isBaja(lead.status) && 'text-muted-foreground',
                      )}>
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
                      {lead.baja_motivo ?? (lead.status === 'VENTA' ? '—' : '—')}
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
