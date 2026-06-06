'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
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
import {
  Settings, UserPlus, Loader2, Check, Pencil, X,
} from 'lucide-react'
import { inviteUserToTenant, updateMyProfile } from '@/app/actions/users'
import { updateTenantInfo } from '@/app/actions/tenant'
import { ModelosTab }  from '@/components/config/modelos-tab'
import { FuentesTab }  from '@/components/config/fuentes-tab'
import { MetasTab }    from '@/components/config/metas-tab'
import { EquiposTab }  from '@/components/config/equipos-tab'
import { AuditTab }   from '@/components/config/audit-tab'
import type { CurrentUser } from '@/lib/auth/get-current-user'
import type { TenantData } from '@/lib/tenant/server'
import type { getMiembrosDelTenant, getEquiposConMiembros } from '@/app/actions/equipos'
import type { getModelosVehiculo } from '@/app/actions/modelos'
import type { getSourcesCustom } from '@/app/actions/sources'
import type { getMetasMensuales } from '@/app/actions/metas'
import type { getAuditLogs } from '@/app/actions/audit'

// ── Types ─────────────────────────────────────────────────────

type Miembro       = Awaited<ReturnType<typeof getMiembrosDelTenant>>[number]
type EquipoCM      = Awaited<ReturnType<typeof getEquiposConMiembros>>[number]
type Modelo        = Awaited<ReturnType<typeof getModelosVehiculo>>[number]
type SourceCustom  = Awaited<ReturnType<typeof getSourcesCustom>>[number]
type MetaRow       = Awaited<ReturnType<typeof getMetasMensuales>>[number]
type AuditRow      = Awaited<ReturnType<typeof getAuditLogs>>[number]

type InviteRole = 'gerente' | 'supervisor' | 'vendedor'

const ROLES_LABEL: Record<string, string> = {
  platform_admin: 'Admin Plataforma',
  dueno: 'Dueño', gerente: 'Gerente', supervisor: 'Supervisor', vendedor: 'Vendedor',
}

const APP_ROLES: InviteRole[] = ['gerente', 'supervisor', 'vendedor']

interface Props {
  user:          CurrentUser
  tenant:        TenantData | null
  miembros:      Miembro[]
  equipos:       EquipoCM[]
  modelos:       Modelo[]
  sourcesCustom: SourceCustom[]
  metas:         MetaRow[]
  auditLogs:     AuditRow[]
  vendedores:    { user_id: string; nombre: string | null; alias: string | null }[]
  canManage:         boolean
  canManageModelos:  boolean
  canSeeConfig:      boolean
  currentYear:   number
  currentMonth:  number
  defaultTab:    string
}

// ── Main ──────────────────────────────────────────────────────

export function ConfiguracionView({
  user, tenant, miembros: initialMiembros, equipos, modelos, sourcesCustom,
  metas, auditLogs, vendedores, canManage, canManageModelos, canSeeConfig, currentYear, currentMonth, defaultTab,
}: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [miembros,    setMiembros]    = useState<Miembro[]>(initialMiembros)
  const [showInvite,  setShowInvite]  = useState(false)
  const [editProfile, setEditProfile] = useState(false)

  const activeTab = searchParams.get('tab') ?? defaultTab

  function onTabChange(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  function refresh() {
    router.refresh()
  }

  return (
    <div className="p-4 md:p-8 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-2.5 mb-6">
        <Settings className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="cuenta">Mi cuenta</TabsTrigger>
          {canSeeConfig && <TabsTrigger value="concesionaria">Concesionaria</TabsTrigger>}
          {canManageModelos && <TabsTrigger value="modelos">Modelos</TabsTrigger>}
          {canManage && <TabsTrigger value="fuentes">Fuentes</TabsTrigger>}
          {canManage && <TabsTrigger value="equipos">Equipos</TabsTrigger>}
          {canSeeConfig && <TabsTrigger value="miembros">Miembros</TabsTrigger>}
          {canManage && <TabsTrigger value="metas">Metas</TabsTrigger>}
          {canManage && <TabsTrigger value="audit">Auditoría</TabsTrigger>}
        </TabsList>

        {/* ── Mi cuenta ─────────────────────────────── */}
        <TabsContent value="cuenta">
          <Card className="p-5 max-w-md">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Perfil
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
            {editProfile
              ? <ProfileForm user={user} onSaved={() => { setEditProfile(false); refresh() }} />
              : (
                <div className="space-y-2 text-sm">
                  <InfoRow label="Nombre"  value={user.nombre} />
                  {user.alias && <InfoRow label="Alias" value={user.alias} />}
                  <InfoRow label="Email"   value={user.email} />
                  <InfoRow label="Rol"     value={ROLES_LABEL[user.rol] ?? user.rol} last />
                </div>
              )}
          </Card>
        </TabsContent>

        {/* ── Concesionaria ─────────────────────────── */}
        {canSeeConfig && (
          <TabsContent value="concesionaria">
            {tenant
              ? <ConcesionariaForm tenant={tenant} canManage={canManage} onSaved={refresh} />
              : <p className="text-sm text-muted-foreground">No hay datos de la concesionaria.</p>}
          </TabsContent>
        )}

        {/* ── Modelos ───────────────────────────────── */}
        {canManageModelos && (
          <TabsContent value="modelos">
            <ModelosTab initialModelos={modelos} />
          </TabsContent>
        )}

        {/* ── Fuentes ───────────────────────────────── */}
        {canManage && (
          <TabsContent value="fuentes">
            <FuentesTab initialSources={sourcesCustom} />
          </TabsContent>
        )}

        {/* ── Equipos ───────────────────────────────── */}
        {canManage && (
          <TabsContent value="equipos">
            <EquiposTab initialEquipos={equipos} allMiembros={miembros} />
          </TabsContent>
        )}

        {/* ── Miembros ──────────────────────────────── */}
        {canSeeConfig && (
          <TabsContent value="miembros">
            <div className="space-y-4">
              {canManage && (
                <div className="flex justify-end">
                  <Button size="sm" className="gap-1.5" onClick={() => setShowInvite(true)}>
                    <UserPlus className="size-3.5" />Invitar usuario
                  </Button>
                </div>
              )}
              <MiembrosTable miembros={miembros} />
            </div>
          </TabsContent>
        )}

        {/* ── Metas ─────────────────────────────────── */}
        {canManage && (
          <TabsContent value="metas">
            <MetasTab
              vendedores={vendedores}
              initialMetas={metas}
              currentYear={currentYear}
              currentMonth={currentMonth}
            />
          </TabsContent>
        )}

        {/* ── Auditoría ─────────────────────────────── */}
        {canManage && (
          <TabsContent value="audit">
            <AuditTab initialLogs={auditLogs} miembros={initialMiembros} />
          </TabsContent>
        )}
      </Tabs>

      <InviteDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        onInvited={() => { refresh(); setMiembros((prev) => prev) }}
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
      const res = await updateMyProfile({ nombre: nombre.trim() || user.nombre, alias: alias.trim() || null })
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
        <Label>Alias <span className="text-muted-foreground font-normal">(opcional)</span></Label>
        <Input placeholder="Ej: Juanchi" value={alias} onChange={(e) => setAlias(e.target.value)} />
      </div>
      <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-1.5">
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Guardar
      </Button>
    </div>
  )
}

// ── ConcesionariaForm ─────────────────────────────────────────

function ConcesionariaForm({
  tenant, canManage, onSaved,
}: { tenant: TenantData; canManage: boolean; onSaved: () => void }) {
  const [editing,  setEditing]  = useState(false)
  const [nombre,   setNombre]   = useState(tenant.nombre)
  const [marca,    setMarca]    = useState(tenant.concesionaria)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const res = await updateTenantInfo({ nombre: nombre.trim(), concesionaria: marca.trim() })
      if (res.success) { toast.success('Concesionaria actualizada'); setEditing(false); onSaved() }
      else toast.error(res.error)
    })
  }

  return (
    <Card className="p-5 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Datos de la concesionaria
        </div>
        {canManage && (
          <Button
            size="sm" variant="ghost"
            className="h-7 gap-1.5 text-muted-foreground"
            onClick={() => setEditing(!editing)}
          >
            {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
            {editing ? 'Cancelar' : 'Editar'}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Marca / concesionaria</Label>
            <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej: Chevrolet, Ford..." />
          </div>
          <Button size="sm" onClick={handleSave} disabled={isPending || !nombre.trim()} className="gap-1.5">
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Guardar
          </Button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <InfoRow label="Nombre"  value={tenant.nombre} />
          <InfoRow label="Marca"   value={tenant.concesionaria} last />
        </div>
      )}
    </Card>
  )
}

// ── MiembrosTable ─────────────────────────────────────────────

function MiembrosTable({ miembros }: { miembros: Miembro[] }) {
  if (miembros.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No hay miembros todavía.</p>
  }
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="px-4 py-2.5 font-medium">Nombre</th>
            <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Email</th>
            <th className="px-4 py-2.5 font-medium">Rol</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {miembros.map((m) => (
            <tr key={m.user_id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
              <td className="px-4 py-2.5 font-medium">
                {m.alias || m.nombre || '—'}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs hidden sm:table-cell">
                {m.email}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant="outline" className="text-[10px]">
                  {ROLES_LABEL[m.rol] ?? m.rol}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                {m.invitation_status === 'accepted' ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check className="size-3" />Activo
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Invitación pendiente</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ── InviteDialog ──────────────────────────────────────────────

function InviteDialog({ open, onOpenChange, onInvited }: {
  open: boolean; onOpenChange: (v: boolean) => void; onInvited: () => void
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
        <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" placeholder="usuario@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre completo *</Label>
            <Input placeholder="Ej: Juan García" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as InviteRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APP_ROLES.map((r) => (<SelectItem key={r} value={r}>{ROLES_LABEL[r]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            El usuario recibirá un email para establecer su contraseña.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleInvite} disabled={!email.trim() || !nombre.trim() || isPending}>
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

