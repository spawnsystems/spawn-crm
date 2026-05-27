'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  ShieldCheck, Building2, CheckCircle2, XCircle, Eye, Plus,
  Users, Loader2, ChevronRight, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { signOut } from '@/app/actions/auth'
import {
  createTenant, suspendTenant, reactivateTenant, enterPreviewMode,
} from '@/app/actions/platform'
import type { CurrentUser } from '@/lib/auth/get-current-user'

interface TenantRow {
  id: string
  nombre: string
  concesionaria: string
  color_primario: string | null
  plan_key: string
  activo: boolean
  memberCount: number
}

interface PlatformViewProps {
  user: CurrentUser
  tenants: TenantRow[]
}

const PLAN_LABELS: Record<string, string> = {
  starter:    'Starter',
  pro:        'Pro',
  enterprise: 'Enterprise',
}

export function PlatformView({ user, tenants: initialTenants }: PlatformViewProps) {
  const [tenants, setTenants] = useState<TenantRow[]>(initialTenants)
  const [showCreate, setShowCreate] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Create form state
  const [nombre, setNombre] = useState('')
  const [concesionaria, setConcesionaria] = useState('')
  const [color, setColor] = useState('#2563eb')
  const [formError, setFormError] = useState('')

  function handleCreate() {
    setFormError('')
    if (!nombre.trim()) { setFormError('El nombre es requerido'); return }
    if (!concesionaria.trim()) { setFormError('La concesionaria es requerida'); return }

    startTransition(async () => {
      const res = await createTenant({ nombre, concesionaria, color_primario: color })
      if (res.success) {
        toast.success('Tenant creado')
        setShowCreate(false)
        setNombre(''); setConcesionaria(''); setColor('#2563eb')
        // Reload — revalidatePath will cause a fresh server fetch on navigation
        window.location.reload()
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleToggleActive(t: TenantRow) {
    startTransition(async () => {
      const action = t.activo ? suspendTenant : reactivateTenant
      const res = await action(t.id)
      if (res.success) {
        setTenants((ts) => ts.map((x) => x.id === t.id ? { ...x, activo: !x.activo } : x))
        toast.success(t.activo ? 'Tenant suspendido' : 'Tenant reactivado')
      } else {
        toast.error(res.error)
      }
    })
  }

  function handlePreview(tenantId: string) {
    startTransition(async () => {
      await enterPreviewMode(tenantId)
    })
  }

  const activeCount = tenants.filter((t) => t.activo).length

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Platform Admin</h1>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <form action={signOut}>
            <Button variant="outline" size="sm">Cerrar sesión</Button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Nav tabs */}
        <div className="flex gap-0 border-b -mt-2">
          <Link
            href="/platform"
            className="px-4 py-2.5 text-sm font-medium text-foreground border-b-2 border-primary -mb-px"
          >
            Concesionarias
          </Link>
          <Link
            href="/platform/users"
            className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Usuarios
          </Link>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Tenants activos" value={activeCount} icon={<Building2 className="size-4" />} />
          <StatCard label="Total usuarios" value={tenants.reduce((a, t) => a + t.memberCount, 0)} icon={<Users className="size-4" />} />
        </div>

        {/* Tenant list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">
              Concesionarias <span className="text-sm font-normal text-muted-foreground ml-1">({tenants.length})</span>
            </h2>
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" />
              Nuevo tenant
            </Button>
          </div>

          {tenants.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed bg-card p-12 text-center">
              <Building2 className="mx-auto mb-3 size-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No hay tenants creados aún</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Creá el primero con el botón de arriba</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    'rounded-xl border bg-card transition-colors',
                    !t.activo && 'opacity-60',
                  )}
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    {/* Color chip */}
                    <div
                      className="size-9 rounded-lg shrink-0 flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: t.color_primario ?? '#2563eb' }}
                    >
                      {t.concesionaria.slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{t.nombre}</span>
                        {t.activo
                          ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                          : <XCircle className="size-3.5 text-destructive shrink-0" />}
                        <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-medium">
                          {PLAN_LABELS[t.plan_key] ?? t.plan_key}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.concesionaria}
                        <span className="mx-1.5">·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Users className="size-2.5" />{t.memberCount} miembros
                        </span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground"
                        onClick={() => handleToggleActive(t)}
                        disabled={isPending}
                      >
                        {t.activo
                          ? <><XCircle className="size-3.5" />Suspender</>
                          : <><CheckCircle2 className="size-3.5" />Reactivar</>}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => handlePreview(t.id)}
                        disabled={isPending}
                      >
                        <Eye className="size-3.5" />
                        Preview
                      </Button>

                      <Link href={`/platform/tenants/${t.id}`}>
                        <Button size="sm" variant="default" className="gap-1">
                          Gestionar
                          <ChevronRight className="size-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create tenant dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { setShowCreate(false); setFormError('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva concesionaria</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre del tenant</Label>
              <Input
                placeholder="Ej: Chevrolet Norte"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Marca / concesionaria</Label>
              <Input
                placeholder="Ej: Chevrolet, Ford, Toyota..."
                value={concesionaria}
                onChange={(e) => setConcesionaria(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color de marca</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-16 rounded border border-border cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-mono">{color}</span>
              </div>
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="size-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Crear tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}
