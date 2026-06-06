'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import { NewLeadDialog } from '@/components/leads/new-lead-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn, formatRelative, getInitials, safeRefetch } from '@/lib/utils'
import { Paginator } from '@/components/ui/paginator'
import { Search, Plus, X, ArrowUp, ArrowDown, ArrowUpDown, XCircle, AlertTriangle } from 'lucide-react'
import { getAllLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { leadSourceValues, leadStatusValues } from '@/lib/schemas/leads'
import { STATUS_ORDER, isBaja } from '@/lib/leads/constants'
import { ATTENTION_LABEL, type AttentionType } from '@/lib/leads/attention'
import { BajaDialog } from '@/components/leads/baja-dialog'

type LeadRow = Awaited<ReturnType<typeof getAllLeads>>[number]

interface AllLeadsViewProps {
  initialLeads: LeadRow[]
  vendedores: Awaited<ReturnType<typeof getVendedoresDelTenant>>
  modelos: string[]
  customSources?: string[]
  canCreate: boolean
}

const ALL       = '__all__'
const PAGE_SIZE = 20

type SortKey = 'last_contact_at' | 'vendedor' | 'status'
type SortDir = 'asc' | 'desc'

export function AllLeadsView({ initialLeads, vendedores, modelos, customSources = [], canCreate }: AllLeadsViewProps) {
  const [leads,        setLeads]        = useState<LeadRow[]>(initialLeads)
  const [search,       setSearch]       = useState('')
  const [filterVend,     setFilterVend]     = useState(ALL)
  const [filterStatus,   setFilterStatus]   = useState(ALL)
  const [filterSource,   setFilterSource]   = useState(ALL)
  const [filterProvincia, setFilterProvincia] = useState(ALL)
  const [filterUsado,    setFilterUsado]    = useState<'all' | 'yes' | 'no'>('all')
  const [filterAtencion, setFilterAtencion] = useState<'all' | 'any' | AttentionType>('all')
  const [openLeadId,     setOpenLeadId]     = useState<string | null>(null)
  const [bajaLead,       setBajaLead]       = useState<LeadRow | null>(null)
  const [showNewLead,    setShowNewLead]    = useState(false)
  const [sortKey,      setSortKey]      = useState<SortKey>('last_contact_at')
  const [sortDir,      setSortDir]      = useState<SortDir>('asc')
  const [page,         setPage]         = useState(1)

  function refresh() {
    void safeRefetch(() => getAllLeads(), 'No se pudieron actualizar los leads')
      .then((next) => { if (next) setLeads(next) })
  }

  const hasFilters = filterVend !== ALL || filterStatus !== ALL || filterSource !== ALL
    || filterProvincia !== ALL || filterUsado !== 'all' || filterAtencion !== 'all' || search.trim() !== ''

  function clearFilters() {
    setSearch('')
    setFilterVend(ALL)
    setFilterStatus(ALL)
    setFilterSource(ALL)
    setFilterProvincia(ALL)
    setFilterUsado('all')
    setFilterAtencion('all')
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Reset a página 1 cuando cambia cualquier filtro o sort
  useEffect(() => { setPage(1) }, [search, filterVend, filterStatus, filterSource, filterProvincia, filterUsado, filterAtencion, sortKey, sortDir])

  // Provincias únicas con al menos un lead
  const provincias = useMemo(() => {
    const set = new Set<string>()
    leads.forEach((l) => { if (l.provincia?.trim()) set.add(l.provincia.trim()) })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [leads])

  const filtered = useMemo(() => {
    const result = leads.filter((l) => {
      if (filterVend !== ALL) {
        if (filterVend === '__unassigned__') {
          if (l.assigned_to !== null) return false
        } else {
          if (l.assigned_to !== filterVend) return false
        }
      }
      if (filterStatus !== ALL && l.status !== filterStatus) return false
      if (filterSource !== ALL && l.source !== filterSource) return false
      if (filterProvincia !== ALL && (l.provincia ?? '').toLowerCase() !== filterProvincia.toLowerCase()) return false
      if (filterUsado === 'yes' && !l.tiene_usado) return false
      if (filterUsado === 'no'  &&  l.tiene_usado) return false
      if (filterAtencion === 'any' && !l.at_risk) return false
      if (filterAtencion !== 'all' && filterAtencion !== 'any' && l.attention_type !== filterAtencion) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matches =
          l.nombre.toLowerCase().includes(q) ||
          (l.modelo ?? '').toLowerCase().includes(q) ||
          (l.vendedor_nombre ?? '').toLowerCase().includes(q) ||
          (l.email ?? '').toLowerCase().includes(q) ||
          (l.telefono ?? '').includes(q) ||
          (l.localidad ?? '').toLowerCase().includes(q) ||
          (l.provincia ?? '').toLowerCase().includes(q) ||
          (l.source_custom ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })

    return result.sort((a, b) => {
      if (sortKey === 'status') {
        const cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
        return sortDir === 'asc' ? cmp : -cmp
      }
      if (sortKey === 'vendedor') {
        const aName = (a.vendedor_alias || a.vendedor_nombre || '').toLowerCase()
        const bName = (b.vendedor_alias || b.vendedor_nombre || '').toLowerCase()
        // Sin asignar siempre al final en ASC
        if (!aName && !bName) return 0
        if (!aName) return sortDir === 'asc' ? 1 : -1
        if (!bName) return sortDir === 'asc' ? -1 : 1
        const cmp = aName.localeCompare(bName, 'es')
        return sortDir === 'asc' ? cmp : -cmp
      }
      // last_contact_at: null (sin contactar) siempre primero en ASC
      const aTime = a.last_contact_at ? new Date(a.last_contact_at).getTime() : null
      const bTime = b.last_contact_at ? new Date(b.last_contact_at).getTime() : null
      if (aTime === null && bTime === null) return 0
      if (aTime === null) return sortDir === 'asc' ? -1 : 1
      if (bTime === null) return sortDir === 'asc' ? 1 : -1
      const cmp = aTime - bTime
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [leads, search, filterVend, filterStatus, filterSource, filterProvincia, filterUsado, filterAtencion, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Todos los Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length !== leads.length
              ? `${filtered.length} de ${leads.length} leads`
              : `${leads.length} leads`}
          </p>
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewLead(true)}>
            <Plus className="size-3.5" />Nuevo Lead
          </Button>
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre, modelo, email..."
            className="pl-8 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Vendedor */}
        {vendedores.length > 0 && (
          <Select value={filterVend} onValueChange={setFilterVend}>
            <SelectTrigger className={cn('h-9 w-44 text-sm', filterVend !== ALL && 'border-primary text-primary')}>
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los vendedores</SelectItem>
              <SelectItem value="__unassigned__">Sin asignar</SelectItem>
              {vendedores.map((v) => (
                <SelectItem key={v.user_id} value={v.user_id}>
                  {v.alias || v.nombre || v.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Estado */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className={cn('h-9 w-40 text-sm', filterStatus !== ALL && 'border-primary text-primary')}>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {leadStatusValues.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Origen */}
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className={cn('h-9 w-40 text-sm', filterSource !== ALL && 'border-primary text-primary')}>
            <SelectValue placeholder="Origen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los orígenes</SelectItem>
            {leadSourceValues.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Atención */}
        <Select value={filterAtencion} onValueChange={(v) => setFilterAtencion(v as typeof filterAtencion)}>
          <SelectTrigger className={cn('h-9 w-44 text-sm', filterAtencion !== 'all' && 'border-amber-500 text-amber-700')}>
            <SelectValue placeholder="Atención" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda la atención</SelectItem>
            <SelectItem value="any">⚠ Requieren atención</SelectItem>
            {(Object.keys(ATTENTION_LABEL) as AttentionType[]).map((t) => (
              <SelectItem key={t} value={t}>{ATTENTION_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Provincia */}
        {provincias.length > 0 && (
          <Select value={filterProvincia} onValueChange={setFilterProvincia}>
            <SelectTrigger className={cn('h-9 w-40 text-sm', filterProvincia !== ALL && 'border-primary text-primary')}>
              <SelectValue placeholder="Provincia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las provincias</SelectItem>
              {provincias.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Tiene usado */}
        <Select value={filterUsado} onValueChange={(v) => setFilterUsado(v as 'all' | 'yes' | 'no')}>
          <SelectTrigger className={cn('h-9 w-36 text-sm', filterUsado !== 'all' && 'border-primary text-primary')}>
            <SelectValue placeholder="Tiene usado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="yes">Con usado</SelectItem>
            <SelectItem value="no">Sin usado</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear */}
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground">
            <X className="size-3.5" />Limpiar
          </Button>
        )}
      </div>

      <Paginator
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="mb-3"
      />

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Modelo</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <SortableTh label="Vendedor"        col="vendedor"        sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortableTh label="Estado"          col="status"          sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <SortableTh label="Último contacto" col="last_contact_at" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((l) => {
                const vendorName = l.vendedor_alias || l.vendedor_nombre
                const lastContact = l.last_contact_at
                  ? formatRelative(new Date(l.last_contact_at))
                  : 'Sin contactar'

                return (
                  <tr
                    key={l.id}
                    className="group border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setOpenLeadId(l.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.nombre}</div>
                      {(l.localidad || l.provincia) && (
                        <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                          {[l.localidad, l.provincia].filter(Boolean).join(', ')}
                        </div>
                      )}
                      {l.tiene_usado && (
                        <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 rounded px-1.5 py-0.5 mt-0.5">
                          Tiene usado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.modelo ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.source_custom || l.source}
                    </td>
                    <td className="px-4 py-3">
                      {vendorName ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold shrink-0">
                            {getInitials(vendorName)}
                          </div>
                          <span className="text-xs">{vendorName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={l.status} />
                        {l.at_risk && l.attention_reason && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
                              l.attention_severity === 'alta'
                                ? 'text-destructive bg-destructive-soft border-destructive/20'
                                : 'text-amber-700 bg-amber-50 border-amber-200/70',
                            )}
                            title={l.attention_detail ?? undefined}
                          >
                            <AlertTriangle className="size-2.5" />
                            {l.attention_reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn(
                      'px-4 py-3 text-xs',
                      l.last_contact_critical ? 'text-destructive font-medium' : 'text-muted-foreground',
                    )}>
                      {lastContact}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isBaja(l.status) && l.status !== 'VENTA' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setBajaLead(l) }}
                            title="Dar de baja"
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7">Ver</Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {hasFilters ? 'No hay leads que coincidan con los filtros.' : 'No se encontraron leads.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
        onStatusChange={(id, status) =>
          setLeads((prev) =>
            prev.map((l) => l.id === id ? { ...l, status: status as LeadRow['status'] } : l),
          )
        }
      />

      {bajaLead && (
        <BajaDialog
          open={!!bajaLead}
          onOpenChange={(v) => { if (!v) setBajaLead(null) }}
          leadId={bajaLead.id}
          leadNombre={bajaLead.nombre}
          onDone={() => { setBajaLead(null); refresh() }}
        />
      )}

      <NewLeadDialog
        open={showNewLead}
        onOpenChange={setShowNewLead}
        vendedores={vendedores}
        modelos={modelos}
        customSources={customSources}
        onCreated={refresh}
      />
    </div>
  )
}

// ── SortableTh ────────────────────────────────────────────────

function SortableTh({
  label, col, sortKey, sortDir, onToggle,
}: {
  label:    string
  col:      SortKey
  sortKey:  SortKey
  sortDir:  SortDir
  onToggle: (col: SortKey) => void
}) {
  const active = sortKey === col
  return (
    <th
      className="px-4 py-3 font-medium cursor-pointer select-none whitespace-nowrap group"
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

