'use client'

import { useState, useTransition } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Trophy, Medal, Plus, UserPlus, Users, Pencil, X,
  UserCircle, Loader2, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createEquipo, updateEquipo, addMemberToEquipo, removeMemberFromEquipo,
  getEquiposConMiembros, getMiembrosDelTenant,
} from '@/app/actions/equipos'
import { inviteUserToTenant } from '@/app/actions/users'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────

type Equipo  = Awaited<ReturnType<typeof getEquiposConMiembros>>[number]
type Miembro = Awaited<ReturnType<typeof getMiembrosDelTenant>>[number]

interface RankingEntry {
  user_id: string
  nombre: string
  alias: string | null
  closed: number
  total: number
  atRisk: number
  conversion: number
}

interface TeamViewProps {
  ranking:   RankingEntry[]
  equipos:   Equipo[]
  miembros:  Miembro[]
  canManage: boolean
}

const MEDAL_COLORS = [
  'bg-yellow-400 text-yellow-900',
  'bg-slate-300 text-slate-700',
  'bg-orange-400 text-orange-900',
]

const ROLES_LABEL: Record<string, string> = {
  dueno: 'Dueño', gerente: 'Gerente', supervisor: 'Supervisor', vendedor: 'Vendedor',
}

// ── Main ──────────────────────────────────────────────────────

export function TeamView({ ranking, equipos: initialEquipos, miembros: initialMiembros, canManage }: TeamViewProps) {
  const router = useRouter()
  const [tab, setTab] = useState<'ranking' | 'equipos'>('ranking')
  const [equipos,  setEquipos]  = useState<Equipo[]>(initialEquipos)
  const [miembros, setMiembros] = useState<Miembro[]>(initialMiembros)

  const now = new Date()
  const monthLabel = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  function refresh() {
    Promise.all([getEquiposConMiembros(), getMiembrosDelTenant()])
      .then(([e, m]) => { setEquipos(e); setMiembros(m) })
    router.refresh()
  }

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{monthLabel}</p>
        </div>
        {canManage && (
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(['ranking', 'equipos'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-2 font-medium transition-colors',
                  tab === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {t === 'ranking' ? 'Ranking' : 'Gestión de equipos'}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'ranking' && <RankingTab ranking={ranking} />}

      {tab === 'equipos' && canManage && (
        <EquiposTab equipos={equipos} miembros={miembros} onRefresh={refresh} />
      )}
    </div>
  )
}

// ── Ranking tab ───────────────────────────────────────────────

function RankingTab({ ranking }: { ranking: RankingEntry[] }) {
  const maxClosed = ranking[0]?.closed ?? 1

  if (ranking.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin datos de ranking este mes.</p>
  }

  return (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <Trophy className="size-4 text-yellow-500" />
        <span>{ranking.length} vendedores activos este mes</span>
      </div>

      {ranking.length >= 2 && (
        <div className="flex items-end justify-center gap-4 mb-8">
          {ranking[1] && <PodiumCard seller={ranking[1]} position={2} />}
          {ranking[0] && <PodiumCard seller={ranking[0]} position={1} featured />}
          {ranking[2] && <PodiumCard seller={ranking[2]} position={3} />}
        </div>
      )}

      {ranking.length > 3 && (
        <div className="space-y-2">
          {ranking.slice(3).map((s, i) => {
            const name = s.alias || s.nombre
            const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
            return (
              <Card key={s.user_id} className="px-5 py-4 flex items-center gap-5">
                <div className="size-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 4}
                </div>
                <div className="size-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {s.atRisk > 0
                      ? <span className="text-destructive">{s.atRisk} en riesgo</span>
                      : 'Al día'}
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm shrink-0">
                  <Metric label="Ventas" value={`${s.closed}`} highlight />
                  <Metric label="Conversión" value={`${s.conversion}%`} />
                  <Metric label="Leads" value={`${s.total}`} />
                </div>
                <div className="w-28 shrink-0">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Ventas</span><span>{s.closed}/{maxClosed}</span>
                  </div>
                  <Progress value={(s.closed / maxClosed) * 100} className="h-1.5" />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Equipos tab ───────────────────────────────────────────────

function EquiposTab({ equipos, miembros, onRefresh }: {
  equipos:   Equipo[]
  miembros:  Miembro[]
  onRefresh: () => void
}) {
  const [showNewEquipo, setShowNewEquipo] = useState(false)
  const [showInvite,    setShowInvite]    = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)

  const gerentes     = miembros.filter((m) => m.rol === 'gerente')
  const supervisores = miembros.filter((m) => m.rol === 'supervisor')
  const vendedores   = miembros.filter((m) => m.rol === 'vendedor')
  const sinEquipo    = vendedores.filter((v) => !v.equipo_id)

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewEquipo(true)}>
          <Plus className="size-3.5" />Nuevo equipo
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowInvite(true)}>
          <UserPlus className="size-3.5" />Invitar usuario
        </Button>
      </div>

      {/* Unassigned vendedores */}
      {sinEquipo.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-4 bg-muted/20">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <UserCircle className="size-3.5" />
            Vendedores sin equipo ({sinEquipo.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {sinEquipo.map((m) => (
              <Badge key={m.user_id} variant="outline" className="text-xs">
                {m.alias || m.nombre || m.email}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Equipo cards */}
      {equipos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No hay equipos creados todavía.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {equipos.map((eq) => (
            <EquipoCard
              key={eq.id}
              equipo={eq}
              gerentes={gerentes}
              supervisores={supervisores}
              vendedores={vendedores}
              isEditing={editingId === eq.id}
              onEdit={() => setEditingId(editingId === eq.id ? null : eq.id)}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Members table */}
      <MembersTable miembros={miembros} />

      <NewEquipoDialog
        open={showNewEquipo}
        onOpenChange={setShowNewEquipo}
        gerentes={gerentes}
        supervisores={supervisores}
        onCreated={onRefresh}
      />
      <InviteDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        onInvited={onRefresh}
      />
    </div>
  )
}

// ── EquipoCard ────────────────────────────────────────────────

function EquipoCard({ equipo, gerentes, supervisores, vendedores, isEditing, onEdit, onRefresh }: {
  equipo:       Equipo
  gerentes:     Miembro[]
  supervisores: Miembro[]
  vendedores:   Miembro[]
  isEditing:    boolean
  onEdit:       () => void
  onRefresh:    () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [nombre,       setNombre]       = useState(equipo.nombre)
  const [gerenteId,    setGerenteId]    = useState(equipo.gerente_id    ?? '__none__')
  const [supervisorId, setSupervisorId] = useState(equipo.supervisor_id ?? '__none__')

  function saveEdit() {
    startTransition(async () => {
      const res = await updateEquipo(equipo.id, {
        nombre:        nombre.trim() || equipo.nombre,
        gerente_id:    gerenteId    === '__none__' ? null : gerenteId,
        supervisor_id: supervisorId === '__none__' ? null : supervisorId,
      })
      if (res.success) { toast.success('Equipo actualizado'); onRefresh(); onEdit() }
      else toast.error(res.error)
    })
  }

  function addVendedor(userId: string) {
    if (!userId || userId === '__none__') return
    startTransition(async () => {
      const res = await addMemberToEquipo(userId, equipo.id)
      if (res.success) { toast.success('Vendedor agregado'); onRefresh() }
      else toast.error(res.error)
    })
  }

  function removeVendedor(userId: string) {
    startTransition(async () => {
      const res = await removeMemberFromEquipo(userId)
      if (res.success) { toast.success('Vendedor removido'); onRefresh() }
      else toast.error(res.error)
    })
  }

  const disponibles = vendedores.filter(
    (v) => !equipo.vendedores.some((ev) => ev.user_id === v.user_id),
  )

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        {isEditing ? (
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-8 text-sm font-semibold" />
        ) : (
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary shrink-0" />
            <span className="font-semibold">{equipo.nombre}</span>
          </div>
        )}
        <div className="flex gap-1 shrink-0">
          {isEditing ? (
            <>
              <Button size="icon" variant="ghost" className="size-7" onClick={saveEdit} disabled={isPending}>
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-success" />}
              </Button>
              <Button size="icon" variant="ghost" className="size-7" onClick={onEdit}>
                <X className="size-3.5" />
              </Button>
            </>
          ) : (
            <Button size="icon" variant="ghost" className="size-7" onClick={onEdit}>
              <Pencil className="size-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Gerente + Supervisor */}
      <div className="grid grid-cols-2 gap-3">
        <RoleSlot label="Gerente"    person={equipo.gerente}    editing={isEditing} options={gerentes}     value={gerenteId}    onChange={setGerenteId} />
        <RoleSlot label="Supervisor" person={equipo.supervisor} editing={isEditing} options={supervisores} value={supervisorId} onChange={setSupervisorId} />
      </div>

      {/* Vendedores */}
      <div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Vendedores ({equipo.vendedores.length})
        </div>
        <div className="space-y-1.5">
          {equipo.vendedores.map((v) => (
            <div key={v.user_id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5">
              <span className="text-sm">{v.alias || v.nombre || v.email}</span>
              <button onClick={() => removeVendedor(v.user_id)} disabled={isPending}
                className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        {disponibles.length > 0 && (
          <div className="mt-2">
            <Select onValueChange={addVendedor} value="__none__">
              <SelectTrigger className="h-8 text-xs border-dashed">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Plus className="size-3" />Agregar vendedor
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>Seleccionar...</SelectItem>
                {disponibles.map((v) => (
                  <SelectItem key={v.user_id} value={v.user_id}>
                    {v.alias || v.nombre || v.email}
                    {v.equipo_id && <span className="text-muted-foreground ml-1 text-xs">(mover)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── RoleSlot ──────────────────────────────────────────────────

function RoleSlot({ label, person, editing, options, value, onChange }: {
  label:    string
  person:   Miembro | null
  editing:  boolean
  options:  Miembro[]
  value:    string
  onChange: (v: string) => void
}) {
  const name = person ? (person.alias || person.nombre || person.email) : null
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      {editing ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder={`Sin ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin {label.toLowerCase()}</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.user_id} value={o.user_id}>
                {o.alias || o.nombre || o.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : name ? (
        <div className="flex items-center gap-1.5">
          <div className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-semibold shrink-0">
            {name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm truncate">{name}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground/50 italic">Sin {label.toLowerCase()}</span>
      )}
    </div>
  )
}

// ── MembersTable ──────────────────────────────────────────────

function MembersTable({ miembros }: { miembros: Miembro[] }) {
  if (miembros.length === 0) return null
  return (
    <Card className="overflow-hidden mt-2">
      <div className="px-5 py-3 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Todos los miembros ({miembros.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Rol</th>
              <th className="px-4 py-2.5 font-medium">Equipo</th>
            </tr>
          </thead>
          <tbody>
            {miembros.map((m) => (
              <tr key={m.user_id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2.5 font-medium">{m.alias || m.nombre || '—'}</td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs">{m.email}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-[10px]">
                    {ROLES_LABEL[m.rol] ?? m.rol}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {m.equipo_id
                    ? <span className="text-success">✓ Asignado</span>
                    : <span className="italic text-muted-foreground/50">Sin equipo</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── NewEquipoDialog ───────────────────────────────────────────

function NewEquipoDialog({ open, onOpenChange, gerentes, supervisores, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void
  gerentes: Miembro[]; supervisores: Miembro[]; onCreated: () => void
}) {
  const [nombre,       setNombre]       = useState('')
  const [gerenteId,    setGerenteId]    = useState('__none__')
  const [supervisorId, setSupervisorId] = useState('__none__')
  const [isPending, startTransition]   = useTransition()

  function reset() { setNombre(''); setGerenteId('__none__'); setSupervisorId('__none__') }

  function handleCreate() {
    if (!nombre.trim()) return
    startTransition(async () => {
      const res = await createEquipo({
        nombre,
        gerente_id:    gerenteId    === '__none__' ? null : gerenteId,
        supervisor_id: supervisorId === '__none__' ? null : supervisorId,
      })
      if (res.success) { toast.success('Equipo creado'); reset(); onOpenChange(false); onCreated() }
      else toast.error(res.error)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Nuevo equipo</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nombre del equipo *</Label>
            <Input placeholder="Ej: Equipo Norte" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gerente</Label>
            <Select value={gerenteId} onValueChange={setGerenteId}>
              <SelectTrigger><SelectValue placeholder="Sin gerente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin gerente</SelectItem>
                {gerentes.map((g) => (
                  <SelectItem key={g.user_id} value={g.user_id}>{g.alias || g.nombre || g.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Supervisor</Label>
            <Select value={supervisorId} onValueChange={setSupervisorId}>
              <SelectTrigger><SelectValue placeholder="Sin supervisor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin supervisor</SelectItem>
                {supervisores.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>{s.alias || s.nombre || s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!nombre.trim() || isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Crear equipo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── InviteDialog ──────────────────────────────────────────────

const APP_ROLES = ['gerente', 'supervisor', 'vendedor'] as const
type InviteRole = typeof APP_ROLES[number]

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
        toast.success('Invitación enviada', { description: `Email enviado a ${email}` })
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
                {APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROLES_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Se enviará un email con un link para que el usuario establezca su contraseña.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleInvite} disabled={!email.trim() || !nombre.trim() || isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Enviar invitación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Podium + shared ───────────────────────────────────────────

function PodiumCard({ seller: s, position, featured }: {
  seller: RankingEntry; position: number; featured?: boolean
}) {
  const name = s.alias || s.nombre
  const initials = name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <Card className={cn('flex flex-col items-center text-center', featured ? 'px-8 py-6 shadow-elevated w-56' : 'px-6 py-5 w-44')}>
      <div className={cn('flex items-center justify-center rounded-full font-bold mb-3', featured ? 'size-10 text-base' : 'size-8 text-sm', MEDAL_COLORS[position - 1] ?? 'bg-muted text-muted-foreground')}>
        {position === 1 ? <Medal className={featured ? 'size-5' : 'size-4'} /> : position}
      </div>
      <div className={cn('rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-semibold mb-3', featured ? 'size-14 text-lg' : 'size-11 text-sm')}>
        {initials}
      </div>
      <div className={cn('font-semibold leading-tight', featured ? 'text-base' : 'text-sm')}>{name}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 mb-3">
        {s.atRisk > 0 ? <span className="text-destructive">{s.atRisk} en riesgo</span> : 'Al día'}
      </div>
      <div className={cn('font-bold text-primary', featured ? 'text-4xl' : 'text-3xl')}>{s.closed}</div>
      <div className="text-xs text-muted-foreground mb-3">ventas del mes</div>
      <div className="w-full border-t border-border pt-3 grid grid-cols-2 gap-2 text-center">
        <div><div className="text-xs font-semibold">{s.conversion}%</div><div className="text-[10px] text-muted-foreground">conversión</div></div>
        <div><div className="text-xs font-semibold">{s.total}</div><div className="text-[10px] text-muted-foreground">leads</div></div>
      </div>
    </Card>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={cn('font-semibold', highlight && 'text-primary')}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
