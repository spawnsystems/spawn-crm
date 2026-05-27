'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inviteUserToTenantAsAdmin, fetchTenantOptions } from '@/app/actions/platform'
import type { AppRole } from '@/lib/auth/get-current-user'

interface TenantOption {
  id:            string
  nombre:        string
  concesionaria: string
}

const ROL_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'vendedor',   label: 'Vendedor'   },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'gerente',    label: 'Gerente'    },
  { value: 'dueno',      label: 'Dueño'      },
]

export function InviteUserDialog() {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [tenants,        setTenants]        = useState<TenantOption[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [tenantsLoaded,  setTenantsLoaded]  = useState(false)

  const [nombre,   setNombre]   = useState('')
  const [email,    setEmail]    = useState('')
  const [rol,      setRol]      = useState<AppRole>('vendedor')
  const [tenantId, setTenantId] = useState<string>('')

  function reset() {
    setNombre('')
    setEmail('')
    setRol('vendedor')
    setTenantId('')
  }

  async function handleOpenChange(o: boolean) {
    if (isLoading) return
    setOpen(o)
    if (!o) { reset(); return }

    if (!tenantsLoaded && !tenantsLoading) {
      setTenantsLoading(true)
      try {
        const list = await fetchTenantOptions()
        setTenants(list)
        setTenantsLoaded(true)
      } catch {
        toast.error('No se pudieron cargar las concesionarias.')
      } finally {
        setTenantsLoading(false)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !nombre.trim() || !tenantId) return

    setIsLoading(true)
    const result = await inviteUserToTenantAsAdmin(tenantId, {
      email:  email.trim(),
      nombre: nombre.trim(),
      rol,
    })
    setIsLoading(false)

    if (!result.success) {
      toast.error('No se pudo enviar la invitación', { description: result.error })
      return
    }

    const tenant = tenants.find((t) => t.id === tenantId)
    toast.success('Invitación enviada', {
      description: `Se invitó a ${email} a "${tenant?.nombre ?? 'la concesionaria'}".`,
    })
    setOpen(false)
    reset()
    router.refresh()
  }

  const canSubmit = !!email.trim() && !!nombre.trim() && !!tenantId && !isLoading

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="size-4" />
          Invitar usuario
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invitar nuevo usuario</DialogTitle>
          <DialogDescription>
            Se enviará un email para que el usuario configure su contraseña.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-nombre">Nombre</Label>
            <Input
              id="invite-nombre"
              placeholder="Ana García"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="ana@concesionaria.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-rol">Rol</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as AppRole)} disabled={isLoading}>
              <SelectTrigger id="invite-rol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROL_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-tenant">Concesionaria</Label>
            <Select
              value={tenantId}
              onValueChange={setTenantId}
              disabled={isLoading || tenantsLoading}
            >
              <SelectTrigger id="invite-tenant">
                <SelectValue placeholder={tenantsLoading ? 'Cargando...' : 'Seleccionar concesionaria...'} />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span>{t.nombre}</span>
                    {t.concesionaria && (
                      <span className="text-muted-foreground ml-1.5">· {t.concesionaria}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); reset() }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isLoading ? (
                <><Loader2 className="mr-1.5 size-4 animate-spin" />Enviando...</>
              ) : (
                'Enviar invitación'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
