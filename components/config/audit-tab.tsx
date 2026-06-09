'use client'

import { useState, useTransition, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Search, X, RefreshCw } from 'lucide-react'
import { Paginator } from '@/components/ui/paginator'
import { getAuditLogs } from '@/app/actions/audit'
import type { getVendedoresDelTenant } from '@/app/actions/users'
import type { getMiembrosDelTenant } from '@/app/actions/equipos'

type AuditRow  = Awaited<ReturnType<typeof getAuditLogs>>[number]
type Miembro   = Awaited<ReturnType<typeof getMiembrosDelTenant>>[number]

// ── Etiquetas legibles ────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  // Lead
  'lead.create':                   'Ingresó un lead',
  'lead.assign':                   'Asignó lead',
  'lead.status_change':            'Cambió etapa',
  'lead.contacted':                'Registró contacto',
  'lead.closed_won':               'Cerró venta',
  'lead.baja':                     'Dio de baja',
  'lead.reactivated_from_rescue':  'Reactivó lead',
  'lead.note_add':                 'Agregó nota',
  'lead.note_deleted':             'Eliminó nota',
  'lead.task_add':                 'Agregó tarea',
  // Ventas / cotizaciones
  'venta.registrar':               'Registró venta',
  'cotizacion.create':             'Cotizó un usado',
  'cotizacion.update':             'Actualizó cotización',
  // Citas
  'appointment.create':            'Pautó cita',
  'appointment.update':            'Editó cita',
  'appointment.cancel':            'Canceló cita',
  'appointment.done':              'Marcó cita realizada',
  'appointment.no_show':           'Registró ausencia',
  'appointment.reschedule':        'Reagendó cita',
  'appointment.resolve':           'Resolvió cita',
  // Usuarios
  'user.invite':                   'Invitó usuario',
  'user.deactivate':               'Desactivó usuario',
  // Configuración
  'tenant.update':                 'Actualizó concesionaria',
  'tenant.sla_update':             'Actualizó alertas',
  'equipo.create':                 'Creó equipo',
  'equipo.update':                 'Actualizó equipo',
  'modelo.create':                 'Creó modelo',
  'modelo.update':                 'Actualizó modelo',
  'modelo.delete':                 'Eliminó modelo',
  'source.create':                 'Creó fuente',
  'source.delete':                 'Eliminó fuente',
  'meta.set':                      'Estableció meta',
}

// Etiquetas legibles para el badge de entidad (en español, singular)
const ENTITY_LABEL: Record<string, string> = {
  lead:        'Lead',
  appointment: 'Cita',
  cotizacion:  'Cotización',
  user:        'Usuario',
  tenant:      'Empresa',
  equipo:      'Equipo',
  modelo:      'Modelo',
  source:      'Fuente',
  meta:        'Meta',
}

const ENTITY_OPTIONS = [
  { value: 'lead',        label: 'Leads' },
  { value: 'appointment', label: 'Citas' },
  { value: 'cotizacion',  label: 'Cotizaciones' },
  { value: 'user',        label: 'Usuarios' },
  { value: 'tenant',      label: 'Empresa' },
  { value: 'equipo',      label: 'Equipos' },
  { value: 'modelo',      label: 'Modelos' },
  { value: 'source',      label: 'Fuentes' },
  { value: 'meta',        label: 'Metas' },
]

const ENTITY_COLOR: Record<string, string> = {
  lead:        'bg-primary/10 text-primary',
  appointment: 'bg-violet-500/10 text-violet-600',
  cotizacion:  'bg-emerald-500/10 text-emerald-600',
  user:        'bg-indigo-500/10 text-indigo-600',
  tenant:      'bg-orange-500/10 text-orange-600',
  equipo:      'bg-teal-500/10 text-teal-600',
  modelo:      'bg-blue-500/10 text-blue-600',
  source:      'bg-pink-500/10 text-pink-600',
  meta:        'bg-yellow-500/10 text-yellow-700',
}

const ALL       = '__all__'
const PAGE_SIZE = 25

// ── Component ─────────────────────────────────────────────────

export function AuditTab({
  initialLogs,
  miembros,
}: {
  initialLogs: AuditRow[]
  miembros: Miembro[]
}) {
  const [logs,        setLogs]        = useState<AuditRow[]>(initialLogs)
  const [search,      setSearch]      = useState('')
  const [filterEntity, setFilterEntity] = useState(ALL)
  const [filterActor,  setFilterActor]  = useState(ALL)
  const [isPending, startTransition]  = useTransition()
  const [page,      setPage]          = useState(1)

  // Filtrado client-side (ya tenemos 200 filas máx)
  const filtered = logs.filter((l) => {
    if (filterEntity !== ALL && l.entity !== filterEntity) return false
    if (filterActor  !== ALL && l.actor_id !== filterActor) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const label = (ACTION_LABEL[l.action] ?? l.action).toLowerCase()
      const actor = (l.actor_alias || l.actor_nombre || '').toLowerCase()
      const meta  = JSON.stringify(l.meta ?? {}).toLowerCase()
      if (!label.includes(q) && !actor.includes(q) && !meta.includes(q)) return false
    }
    return true
  })

  const hasFilters = filterEntity !== ALL || filterActor !== ALL || search.trim() !== ''

  useEffect(() => { setPage(1) }, [search, filterEntity, filterActor])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function clearFilters() {
    setSearch('')
    setFilterEntity(ALL)
    setFilterActor(ALL)
  }

  function reload() {
    startTransition(async () => {
      const fresh = await getAuditLogs()
      setLogs(fresh)
    })
  }

  // Actores únicos que tienen logs
  const actores = miembros.filter((m) =>
    logs.some((l) => l.actor_id === m.user_id),
  )

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Buscar */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar acción, usuario..."
            className="pl-8 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Entidad */}
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="Entidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las entidades</SelectItem>
            {ENTITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Actor */}
        {actores.length > 0 && (
          <Select value={filterActor} onValueChange={setFilterActor}>
            <SelectTrigger className="h-9 w-40 text-sm">
              <SelectValue placeholder="Usuario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los usuarios</SelectItem>
              {actores.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.alias || m.nombre || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Limpiar */}
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground">
            <X className="size-3.5" />Limpiar
          </Button>
        )}

        {/* Reload */}
        <Button size="sm" variant="outline" onClick={reload} disabled={isPending} className="h-9 gap-1.5 ml-auto">
          <RefreshCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Contador */}
      <p className="text-xs text-muted-foreground">
        {filtered.length !== logs.length
          ? `${filtered.length} de ${logs.length} registros`
          : `${logs.length} registros`}
      </p>

      <Paginator
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="mb-1"
      />

      {/* Tabla */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? 'No hay registros que coincidan con los filtros.'
              : 'No hay registros de auditoría todavía.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-4 py-2.5 font-medium">Acción</th>
                  <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Detalle</th>
                  <th className="px-4 py-2.5 font-medium">Usuario</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Paginator
        page={page}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        className="mt-3"
      />
    </div>
  )
}

// ── AuditRow ──────────────────────────────────────────────────

function AuditRow({ log }: { log: AuditRow }) {
  const actionLabel = ACTION_LABEL[log.action] ?? log.action
  const actorName   = log.actor_alias || log.actor_nombre || 'Sistema'
  const entityColor = ENTITY_COLOR[log.entity] ?? 'bg-muted text-muted-foreground'
  const meta        = log.meta as Record<string, unknown> | null

  // Construir descripción legible del meta
  const detail = buildDetail(log.action, meta)

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-muted/20">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] font-medium shrink-0 ${entityColor}`} variant="secondary">
            {ENTITY_LABEL[log.entity] ?? log.entity}
          </Badge>
          <span className="font-medium text-sm">{actionLabel}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell max-w-[220px] truncate">
        {detail}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {actorName}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(log.created_at)}
      </td>
    </tr>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function buildDetail(action: string, meta: Record<string, unknown> | null): string {
  if (!meta) return '—'

  if (action === 'lead.status_change') {
    return `${meta.from ?? '?'} → ${meta.to ?? '?'}`
  }
  if (action === 'lead.assign') {
    // vendedor_nombre agregado al meta desde la acción; fallback a Bandeja General
    return meta.vendedor_nombre
      ? `Asignado a ${meta.vendedor_nombre}`
      : 'Enviado a Bandeja General'
  }
  if (action === 'lead.create') {
    const asig = meta.vendedor_nombre ? ` → ${meta.vendedor_nombre}` : ''
    return `${meta.nombre ?? '?'}${asig}`
  }
  if (action === 'appointment.create') {
    const tipo = meta.tipo ? String(meta.tipo).replace(/_/g, ' ') : 'cita'
    return tipo.charAt(0).toUpperCase() + tipo.slice(1)
  }
  if (action === 'appointment.reschedule') {
    return '—'
  }
  if (action === 'lead.baja') {
    // motivo de la baja (NO CONTESTA, NO INTERESADO, etc.)
    return meta.status ? `Motivo: ${meta.status}` : '—'
  }
  if (action === 'venta.registrar') {
    return String(meta.modelo ?? '—')
  }
  if (action === 'cotizacion.create' || action === 'cotizacion.update') {
    if (meta.marca_modelo) return String(meta.marca_modelo)
    return meta.uso === 'taxi_uber_transporte' ? 'Taxi / Uber'
      : meta.uso === 'particular' ? 'Particular'
      : '—'
  }
  if (action.startsWith('lead.')) {
    return String(meta.nombre ?? meta.lead ?? '—')
  }
  if (action === 'user.invite') {
    return `${meta.email ?? '?'} (${meta.rol ?? '?'})`
  }
  if (action === 'meta.set') {
    const quien  = meta.vendedor_nombre ?? meta.vendedor ?? 'Vendedor'
    const ventas = meta.value ?? '?'
    const periodo = (meta.mes && meta.anio) ? ` · ${meta.mes}/${meta.anio}` : ''
    return `${quien}: ${ventas} ventas${periodo}`
  }
  // Genérico: primer valor de string del meta
  const first = Object.values(meta).find((v) => typeof v === 'string')
  return first ? String(first) : '—'
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH  = Math.floor(diffMs / 3_600_000)
  const diffD  = Math.floor(diffH / 24)

  if (diffH < 1)  return 'Hace menos de 1h'
  if (diffH < 24) return `Hace ${diffH}h`
  if (diffD === 1) return 'Ayer'
  if (diffD < 7)  return `Hace ${diffD} días`

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d)
}
