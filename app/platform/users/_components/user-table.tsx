'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, ShieldCheck, User, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { PlatformUserActions } from './user-actions'
import type { UserRow, PlatformUserStatus } from '@/app/actions/platform'

const PAGE_SIZE = 15

const STATUS_BADGE: Record<PlatformUserStatus, { label: string; className: string }> = {
  activo:    { label: 'Activo',       className: 'text-emerald-600 bg-emerald-50 border-emerald-200'  },
  pendiente: { label: 'Pendiente',    className: 'text-amber-600  bg-amber-50  border-amber-200'      },
  expirado:  { label: 'Expirado',     className: 'text-orange-600 bg-orange-50 border-orange-200'     },
  inactivo:  { label: 'Inactivo',     className: 'text-zinc-500   bg-zinc-100  border-zinc-200'       },
  baneado:   { label: 'Dado de baja', className: 'text-red-600    bg-red-50    border-red-200'        },
}

const ROL_LABELS: Record<string, string> = {
  platform_admin: 'Platform Admin',
  dueno:          'Dueño',
  gerente:        'Gerente',
  supervisor:     'Supervisor',
  vendedor:       'Vendedor',
}

interface UserTableProps {
  users: UserRow[]
}

export function UserTable({ users }: UserTableProps) {
  const [search,       setSearch]       = useState('')
  const [roleFilter,   setRoleFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tenantFilter, setTenantFilter] = useState('all')
  const [page,         setPage]         = useState(1)

  const tenantOptions = useMemo(() => {
    const names = new Set(
      users.map((u) => u.tenant_nombre).filter((n): n is string => !!n),
    )
    return Array.from(names).sort()
  }, [users])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return users.filter((u) => {
      if (q) {
        const matchSearch =
          u.nombre.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        if (!matchSearch) return false
      }
      if (roleFilter   !== 'all' && u.rol          !== roleFilter)   return false
      if (statusFilter !== 'all' && u.status        !== statusFilter) return false
      if (tenantFilter !== 'all' && u.tenant_nombre !== tenantFilter) return false
      return true
    })
  }, [users, search, roleFilter, statusFilter, tenantFilter])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleFilterChange(fn: () => void) {
    fn()
    setPage(1)
  }

  const hasFilters = search || roleFilter !== 'all' || statusFilter !== 'all' || tenantFilter !== 'all'

  return (
    <div className="space-y-4">
      {/* ── Barra de búsqueda y filtros ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => handleFilterChange(() => setSearch(e.target.value))}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Select value={statusFilter} onValueChange={(v) => handleFilterChange(() => setStatusFilter(v))}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="expirado">Expirado</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
              <SelectItem value="baneado">Dado de baja</SelectItem>
            </SelectContent>
          </Select>

          <Select value={roleFilter} onValueChange={(v) => handleFilterChange(() => setRoleFilter(v))}>
            <SelectTrigger className="h-9 w-36 text-sm">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los roles</SelectItem>
              <SelectItem value="dueno">Dueño</SelectItem>
              <SelectItem value="gerente">Gerente</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
              <SelectItem value="vendedor">Vendedor</SelectItem>
            </SelectContent>
          </Select>

          {tenantOptions.length > 0 && (
            <Select value={tenantFilter} onValueChange={(v) => handleFilterChange(() => setTenantFilter(v))}>
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue placeholder="Concesionaria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {tenantOptions.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ── Contador ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span>
          {hasFilters
            ? `${filtered.length} de ${users.length} usuarios`
            : `${users.length} usuarios`}
        </span>
        {totalPages > 1 && (
          <span>Página {currentPage} de {totalPages}</span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 flex flex-col items-center gap-2 text-muted-foreground">
          <User className="h-7 w-7 opacity-30" />
          <p className="text-sm">Sin resultados</p>
          {hasFilters && (
            <button
              onClick={() => {
                setSearch('')
                setRoleFilter('all')
                setStatusFilter('all')
                setTenantFilter('all')
                setPage(1)
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-1"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Mobile cards ── */}
          <div className="md:hidden space-y-3">
            {paginated.map((u) => {
              const canAct = !u.is_platform_admin && !!u.tenant_id
              const badge  = STATUS_BADGE[u.status]
              return (
                <div key={`${u.id}-${u.tenant_id}`} className="relative rounded-xl border bg-card p-4">
                  {canAct && (
                    <div className="absolute top-2 right-2">
                      <PlatformUserActions
                        userId={u.id}
                        userEmail={u.email}
                        userNombre={u.nombre}
                        currentRol={u.member_rol ?? u.rol}
                        tenantId={u.tenant_id!}
                        isBanned={u.isBanned}
                      />
                    </div>
                  )}
                  <div className={canAct ? 'pr-8' : ''}>
                    <p className="font-semibold truncate">{u.nombre || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                    <span className="flex items-center gap-1">
                      {u.is_platform_admin
                        ? <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                        : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className={u.is_platform_admin ? 'text-purple-600' : 'text-muted-foreground'}>
                        {u.is_platform_admin ? 'Platform Admin' : (ROL_LABELS[u.member_rol ?? u.rol] ?? u.rol)}
                      </span>
                    </span>
                    {u.tenant_nombre && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        {u.tenant_nombre}
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded border text-[11px] font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden md:block rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Usuario</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Rol</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Concesionaria</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((u, i) => {
                  const badge  = STATUS_BADGE[u.status]
                  const isLast = i === paginated.length - 1
                  return (
                    <tr
                      key={`${u.id}-${u.tenant_id}`}
                      className={`border-b hover:bg-muted/30 transition-colors ${isLast ? 'border-b-0' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.nombre || '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm">
                          {u.is_platform_admin
                            ? <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
                            : u.member_rol === 'dueno'
                              ? <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                              : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className={u.is_platform_admin ? 'text-purple-600' : ''}>
                            {u.is_platform_admin
                              ? 'Platform Admin'
                              : (ROL_LABELS[u.member_rol ?? u.rol] ?? u.rol)}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.tenant_nombre ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            {u.tenant_nombre}
                            {u.concesionaria && (
                              <span className="text-xs text-muted-foreground/60">· {u.concesionaria}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {!u.is_platform_admin && !!u.tenant_id && (
                          <PlatformUserActions
                            userId={u.id}
                            userEmail={u.email}
                            userNombre={u.nombre}
                            currentRol={u.member_rol ?? u.rol}
                            tenantId={u.tenant_id}
                            isBanned={u.isBanned}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Paginación ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${idx}`} className="text-muted-foreground text-sm px-1">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p)}
                      className={`h-8 w-8 p-0 text-sm ${currentPage === p ? 'bg-primary text-primary-foreground border-primary' : ''}`}
                    >
                      {p}
                    </Button>
                  ),
                )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
