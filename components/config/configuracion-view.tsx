'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Settings, UserPlus, Loader2, Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { inviteUserToTenant } from '@/app/actions/users'
import { updateMyProfile } from '@/app/actions/users'
import { getMiembrosDelTenant } from '@/app/actions/equipos'
import { useRouter } from 'next/navigation'
import type { CurrentUser } from '@/lib/auth/get-current-user'
import type { TenantData } from '@/lib/tenant/server'

// ── Types ─────────────────────────────────────────────────────

type Miembro = Awaited<ReturnType<typeof getMiembrosDelTenant>>[number]

type InviteRole = 'gerente' | 'supervisor' | 'vendedor'

const ROLES_LABEL: Record<string, string> = {
  platform_admin: 'Admin Plataforma',
  dueno: 'Dueño', gerente: 'Gerente', supervisor: 'Supervisor', vendedor: 'Vendedor',
}

const STATUS_LABEL: Record<string, string> = {
  pending:  'Pendiente',
  accepted: 'Activo',
}

const APP_ROLES: InviteRole[] = ['gerente', 'supervisor', 'vendedor']

interface Props {
  user:       CurrentUser
  tenant:     TenantData | null
  miembros:   Miembro[]
  canManage:  boolean
}

// ── Main ──────────────────────────────────────────────────────

export function ConfiguracionView({ user, tenant, miembros: initialMiembros, canManage }: Props) {
  const router = useRouter()
  const [miembros,    setMiembros]    = useState<Miembro[]>(initialMiembros)
  const [showInvite,  setShowInvite]  = useState(false)
  const [editProfile, setEditProfile] = useState(false)

  function refresh() {
    getMiembrosDelTenant().then(setMiembros)
    router.refresh()
  }

  return (
    <div className="p-4 md:p-8 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2.5 mb-6">
        <Settings className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
      </div>

      <div className="space-y-5">

        {/* ── Mi cuenta ───────────────────────────────────── */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Mi cuenta
            </div>
            <Button
              size="sm" variant="ghost"
              className="h-7 gap-1.5 text-muted-foreground"
              onClick={() => setEditProfile(!editProfile)}
            >
              {editProfile ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
              {editProfile ? 'Cancelar' : 'Editar'}
            </Button>
          </div>

          {editProfile ? (
            <ProfileForm user={user} onSaved={() => { setEditProfile(false); refresh() }} />
          ) : (
            <div className="space-y-2 text-sm">
              <InfoRow label="Nombre"  value={user.nombre} />
              {user.alias && <InfoRow label="Alias" value={user.alias} />}
              <InfoRow label="Email"   value={user.email} />
              <InfoRow label="Rol"     value={ROLES_LABEL[user.rol] ?? user.rol} last />
            </div>
          )}
        </Card>

        {/* ── Concesionaria (read-only para no-dueños) ─── */}
        {tenant && (
          <Card className="p-5">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
              Concesionaria
            </div>
            <div className="space-y-2 text-sm">
              <InfoRow label="Nombre" value={tenant.nombre} />
              <InfoRow label="Marca"  value={tenant.concesionaria} last />
            </div>
          </Card>
        )}

        {/* ── Equipo (solo dueño/platform_admin) ─────────── */}
        {canManage && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Miembros del equipo
              </div>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setShowInvite(true)}
              >
                <UserPlus className="size-3.5" />
                Invitar usuario
              </Button>
            </div>

            {miembros.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No hay miembros todavía.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">Nombre</th>
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Rol</th>
                      <th className="pb-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {miembros.map((m) => (
                      <tr key={m.user_id} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">
                          {m.alias || m.nombre || '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                          {m.email}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className="text-[10px]">
                            {ROLES_LABEL[m.rol] ?? m.rol}
                          </Badge>
                        </td>
                        <td className="py-2.5">
                          {m.invitation_status === 'accepted' ? (
                            <span className="flex items-center gap-1 text-xs text-success">
                              <Check className="size-3" />Activo
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Invitación pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

      </div>

      <InviteDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        onInvited={refresh}
      />
    </div>
  )
}

// ── ProfileForm ───────────────────────────────────────────────

function ProfileForm({ user, onSaved }: { user: CurrentUser; onSaved: () => void }) {
  const [nombre, setNombre] = useState(user.nombre)
  const [alias,  setAlias]  = useState(user.alias ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const res = await updateMyProfile({
        nombre: nombre.trim() || user.nombre,
        alias:  alias.trim() || null,
      })
      if (res.success) { toast.success('Perfil actualizado'); onSaved() }
      else toast.error(res.error)
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Nombre</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Alias <span className="text-muted-foreground font-normal">(opcional, se muestra en lugar del nombre)</span></Label>
        <Input placeholder="Ej: Juanchi" value={alias} onChange={(e) => setAlias(e.target.value)} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5">
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Guardar
        </Button>
      </div>
    </div>
  )
}

// ── InviteDialog ──────────────────────────────────────────────

function InviteDialog({ open, onOpenChange, onInvited }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onInvited: () => void
}) {
  const [email,  setEmail]  = useState('')
  const [nombre, setNombre] = useState('')
  const [rol,    setRol]    = useState<InviteRole>('vendedor')
  const [isPending, startTransition] = useTransition()

  function reset() { setEmail(''); setNombre(''); setRol('vendedor') }

  function handleInvite() {
    if (!email.trim() || !nombre.trim()) return
    startTransition(async () => {
      const res = await inviteUserToTenant({ email, nombre, rol })
      if (res.success) {
        toast.success('Invitación enviada', { description: `Se envió un email a ${email}` })
        reset(); onOpenChange(false); onInvited()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input
              type="email"
              placeholder="usuario@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre completo *</Label>
            <Input
              placeholder="Ej: Juan García"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as InviteRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLES_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            El usuario recibirá un email para establecer su contraseña y acceder al CRM.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { reset(); onOpenChange(false) }}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleInvite}
            disabled={!email.trim() || !nombre.trim() || isPending}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Enviar invitación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Shared ─────────────────────────────────────────────────────

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${!last ? 'border-b border-border/50' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
