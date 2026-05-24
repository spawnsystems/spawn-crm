'use client'

import { useState, useMemo } from 'react'
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
import { Search, Plus, X } from 'lucide-react'
import { getAllLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'
import { leadSourceValues, leadStatusValues } from '@/lib/schemas/leads'

type LeadRow = Awaited<ReturnType<typeof getAllLeads>>[number]

interface AllLeadsViewProps {
  initialLeads: LeadRow[]
  vendedores: Awaited<ReturnType<typeof getVendedoresDelTenant>>
  modelos: string[]
  canCreate: boolean
}

const ALL = '__all__'

export function AllLeadsView({ initialLeads, vendedores, modelos, canCreate }: AllLeadsViewProps) {
  const [leads,       setLeads]       = useState<LeadRow[]>(initialLeads)
  const [search,      setSearch]      = useState('')
  const [filterVend,  setFilterVend]  = useState(ALL)
  const [filterStatus, setFilterStatus] = useState(ALL)
  const [filterSource, setFilterSource] = useState(ALL)
  const [openLeadId,  setOpenLeadId]  = useState<string | null>(null)
  const [showNewLead, setShowNewLead] = useState(false)

  function refresh() {
    // safeRefetch ya atrapa errores; la promesa se descarta intencionalmente.
    void safeRefetch(() => getAllLeads(), 'No se pudieron actualizar los leads')
      .then((next) => { if (next) setLeads(next) })
  }

  const hasFilters = filterVend !== ALL || filterStatus !== ALL || filterSource !== ALL || search.trim() !== ''

  function clearFilters() {
    setSearch('')
    setFilterVend(ALL)
    setFilterStatus(ALL)
    setFilterSource(ALL)
  }

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filterVend !== ALL) {
        if (filterVend === '__unassigned__') {
          if (l.assigned_to !== null) return false
        } else {
          if (l.assigned_to !== filterVend) return false
        }
      }
      if (filterStatus !== ALL && l.status !== filterStatus) return false
      if (filterSource !== ALL && l.source !== filterSource) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matches =
          l.nombre.toLowerCase().includes(q) ||
          (l.modelo ?? '').toLowerCase().includes(q) ||
          (l.vendedor_nombre ?? '').toLowerCase().includes(q) ||
          (l.email ?? '').toLowerCase().includes(q) ||
          (l.telefono ?? '').includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [leads, search, filterVend, filterStatus, filterSource])

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

        {/* Clear */}
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground">
            <X className="size-3.5" />Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Modelo</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Último contacto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const vendorName = l.vendedor_alias || l.vendedor_nombre
                const lastContact = l.last_contact_at
                  ? formatRelative(new Date(l.last_contact_at))
                  : 'Sin contactar'

                return (
                  <tr
                    key={l.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setOpenLeadId(l.id)}
                  >
                    <td className="px-4 py-3 font-medium">{l.nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.modelo ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.source}</td>
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
                    <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                    <td className={cn(
                      'px-4 py-3 text-xs',
                      l.last_contact_critical ? 'text-destructive font-medium' : 'text-muted-foreground',
                    )}>
                      {lastContact}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" className="h-7">Ver</Button>
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

      <LeadDetailSheet
        leadId={openLeadId}
        onClose={() => { setOpenLeadId(null); refresh() }}
        onStatusChange={(id, status) =>
          setLeads((prev) =>
            prev.map((l) => l.id === id ? { ...l, status: status as LeadRow['status'] } : l),
          )
        }
      />

      <NewLeadDialog
        open={showNewLead}
        onOpenChange={setShowNewLead}
        vendedores={vendedores}
        modelos={modelos}
        onCreated={refresh}
      />
    </div>
  )
}

