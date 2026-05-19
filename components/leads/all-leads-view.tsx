'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/status-badge'
import { LeadDetailSheet } from '@/components/leads/lead-detail-sheet'
import { NewLeadDialog } from '@/components/leads/new-lead-dialog'
import { cn } from '@/lib/utils'
import { Search, Plus } from 'lucide-react'
import { getAllLeads } from '@/app/actions/leads'
import { getVendedoresDelTenant } from '@/app/actions/users'

type LeadRow = Awaited<ReturnType<typeof getAllLeads>>[number]

interface AllLeadsViewProps {
  initialLeads: LeadRow[]
  vendedores: Awaited<ReturnType<typeof getVendedoresDelTenant>>
  canCreate: boolean
}

export function AllLeadsView({ initialLeads, vendedores, canCreate }: AllLeadsViewProps) {
  const [leads, setLeads]         = useState<LeadRow[]>(initialLeads)
  const [search, setSearch]       = useState('')
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [showNewLead, setShowNewLead] = useState(false)

  function refresh() {
    getAllLeads().then(setLeads)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return leads
    const q = search.toLowerCase()
    return leads.filter((l) =>
      l.nombre.toLowerCase().includes(q) ||
      (l.modelo ?? '').toLowerCase().includes(q) ||
      (l.vendedor_nombre ?? '').toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q),
    )
  }, [leads, search])

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Todos los Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{leads.length} leads en el sistema</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, modelo..."
              className="pl-8 h-9 w-64 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowNewLead(true)}>
              <Plus className="size-3.5" />Nuevo Lead
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
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
                        <div className="flex size-5 items-center justify-center rounded-full bg-primary-soft text-primary text-[9px] font-semibold shrink-0">
                          {vendorName.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
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
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No se encontraron leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
        onCreated={refresh}
      />
    </div>
  )
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffD = Math.floor(diffH / 24)
  if (diffH < 1)   return 'Hace menos de 1h'
  if (diffH < 24)  return `Hace ${diffH}h`
  if (diffD === 1) return 'Ayer'
  return `Hace ${diffD} días`
}
