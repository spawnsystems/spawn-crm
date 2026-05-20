'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Building2, Users, UserPlus, CheckCircle2, XCircle,
  Clock, ShieldCheck, Loader2, Save, AlertCircle, Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  updateTenantInfo, inviteUserToTenantAsAdmin, deactivateMemberAdmin, enterPreviewMode,
} from '@/app/actions/platform'
import type { AppRole } from '@/lib/auth/get-current-user'

// ── Types ─────────────────────────────────────────────────────

interface TenantRow {
  id: string
  nombre: string
  concesionaria: string
  color_primario: string | null
  plan_key: string
  activo: boolean
  logo_url: string | null
}

interface MemberRow {
  user_id: string | null
  rol: string | null
  activo: boolean | null
  invitation_status: string | null
  invited_at: Date | null
  nombre: string | null
  alias: string | null
  email: string | null
}

interface TenantDetailViewProps {
  tenant: TenantRow
  members: MemberRow[]
}

const ROL_LABELS: Record<AppRole, string> = {
  platform_admin: 'Platform Admin',
  dueno:          'Dueño',
  gerente:        'Gerente',
  supervisor:     'Supervisor',
  vendedor:       'Vendedor',
}

const TENANT_ROLES: AppRole[] = ['dueno', 'gerente', 'supervisor', 'vendedor']

const PLAN_OPTIONS = ['starter', 'pro', 'enterprise']

// ── Component ─────────────────────────────────────────────────

export function TenantDetailView({ tenant: initialTenant, members: initialMembers }: TenantDetailViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Tenant edit state
  const [tenant, setTenant] = useState(initialTenant)
  const [nombre, setNombre] = useState(initialTenant.nombre)
  const [concesionaria, setConcesionaria] = useState(initialTenant.concesionaria)
  const [color, setColor] = useState(initialTenant.color_primario ?? '#2563eb')
  const [planKey, setPlanKey] = useState(initialTenant.plan_key)
  const [isDirty, setIsDirty] = useState(false)

  // Members state
  const [members, setMembers] = useState<MemberRow[]>(initialMembers)

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false)
  const [invEmail, setInvEmail]   = useState('')
  const [invNombre, setInvNombre] = useState('')
  const [invRol, setInvRol]       = useState<AppRole>('vendedor')
  const [invError, setInvError]   = useState('')

  function markDirty() { setIsDirty(true) }

  function handleSave() {
    startTransition(async () => {
      const res = await updateTenantInfo(tenant.id, {
        nombre, concesionaria, color_primario: color, plan_key: planKey,
      })
      if (res.success) {
        toast.success('Tenant actualizado')
        setIsDirty(false)
        setTenant((t) => ({ ...t, nombre, concesionaria, color_primario: color, plan_key: planKey }))
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleInvite() {
    setInvError('')
    if (!invEmail.trim() || !invEmail.includes('@')) {
      setInvError('Email inválido')
      return
    }
    if (!invNombre.trim()) {
      setInvError('El nombre es requerido')
      return
    }

    startTransition(async () => {
      const res = await inviteUserToTenantAsAdmin(tenant.id, {
        email: invEmail,
        nombre: invNombre,
        rol: invRol,
      })
      if (res.success) {
        toast.success('Invitación enviada correctamente')
        setShowInvite(false)
        setInvEmail(''); setInvNombre(''); setInvRol('vendedor'); setInvError('')
        // Refresh members list
        router.refresh()
      } else {
        setInvError(res.error)
      }
    })
  }

  function handleDeactivate(userId: string) {
    startTransition(async () => {
      const res = await deactivateMemberAdmin(tenant.id, userId)
      if (res.success) {
        setMembers((ms) => ms.map((m) => m.user_id === userId ? { ...m, activo: false } : m))
        toast.success('Miembro desactivado')
      } else {
        toast.error(res.error)
      }
    })
  }

  function handlePreview() {
    startTransition(async () => {
      await enterPreviewMode(tenant.id)
    })
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/platform">
              <Button variant="ghost" size="icon" className="size-8">
                <ArrowLeft className="size-4" />
              </Button>
            </Link>
            <div
              className="size-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: tenant.color_primario ?? '#2563eb' }}
            >
              {tenant.concesionaria.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">{tenant.nombre}</h1>
              <p className="text-xs text-muted-foreground">{tenant.concesionaria} · {tenant.plan_key}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePreview} disabled={isPending}>
            <Eye className="size-3.5" />
            Entrar en preview
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">

        {/* ── Tenant info ──────────────────────────────────────── */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">Información del tenant</h2>
            </div>
            {isDirty && (
              <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Guardar cambios
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nombre del tenant</Label>
              <Input
                value={nombre}
                onChange={(e) => { setNombre(e.target.value); markDirty() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Marca / concesionaria</Label>
              <Input
                value={concesionaria}
                onChange={(e) => { setConcesionaria(e.target.value); markDirty() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color de marca</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => { setColor(e.target.value); markDirty() }}
                  className="h-9 w-16 rounded border border-border cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-mono">{color}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={planKey} onValueChange={(v) => { setPlanKey(v); markDirty() }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* ── Members ──────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h2 className="font-semibold">
                Miembros <span className="text-sm font-normal text-muted-foreground">({members.length})</span>
              </h2>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setShowInvite(true)}>
              <UserPlus className="size-3.5" />
              Invitar usuario
            </Button>
          </div>

          {members.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 size-6 opacity-30" />
              No hay miembros aún. Invitá al dueño para empezar.
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-4 py-3 font-medium">Usuario</th>
                      <th className="px-4 py-3 font-medium">Rol</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Invitación</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const name = m.alias || m.nombre || '—'
                      const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()

                      return (
                        <tr key={m.user_id} className="border-b border-border/50 last:border-0">
                          {/* User */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                                m.activo ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                              )}>
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium truncate">{name}</div>
                                <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Rol */}
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium',
                              m.rol === 'dueno'     && 'bg-primary/10 text-primary',
                              m.rol === 'gerente'   && 'bg-warning-soft text-warning-foreground',
                              m.rol === 'supervisor'&& 'bg-info-soft text-info',
                              m.rol === 'vendedor'  && 'bg-muted text-muted-foreground',
                            )}>
                              {m.rol === 'dueno' && <ShieldCheck className="size-3" />}
                              {ROL_LABELS[m.rol as AppRole] ?? m.rol}
                            </span>
                          </td>

                          {/* Activo */}
                          <td className="px-4 py-3">
                            {m.activo
                              ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="size-3.5" />Activo</span>
                              : <span className="flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="size-3.5" />Inactivo</span>}
                          </td>

                          {/* Invitation status */}
                          <td className="px-4 py-3">
                            {m.invitation_status === 'pending' ? (
                              <span className="flex items-center gap-1 text-xs text-warning-foreground"><Clock className="size-3.5" />Pendiente</span>
                            ) : m.invitation_status === 'accepted' ? (
                              <span className="text-xs text-muted-foreground">Aceptada</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            {m.activo && m.user_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                disabled={isPending}
                                onClick={() => handleDeactivate(m.user_id!)}
                              >
                                Desactivar
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog
        open={showInvite}
        onOpenChange={(v) => { if (!v) { setShowInvite(false); setInvError('') } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar usuario a {tenant.nombre}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input
                placeholder="Ej: Juan García"
                value={invNombre}
                onChange={(e) => setInvNombre(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="juan@chevrolet.com"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={invRol} onValueChange={(v) => setInvRol(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TENANT_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROL_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {invError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="size-4 shrink-0" />
                {invError}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Se enviará un email con un enlace para que el usuario configure su contraseña y acceda al CRM.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={isPending}>
              {isPending
                ? <Loader2 className="size-4 animate-spin" />
                : <><UserPlus className="size-3.5 mr-1.5" />Enviar invitación</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
