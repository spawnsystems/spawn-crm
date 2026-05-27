'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, UserX, UserCheck, Loader2, KeyRound, ShieldCheck } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  changeUserRole,
  deactivateUserAdmin,
  reactivateUserAdmin,
  resetUserPasswordAdmin,
} from '@/app/actions/platform'
import type { AppRole } from '@/lib/auth/get-current-user'

const ROL_LABELS: Record<string, string> = {
  dueno:      'Dueño',
  gerente:    'Gerente',
  supervisor: 'Supervisor',
  vendedor:   'Vendedor',
}

const ROLES_SELECCIONABLES: AppRole[] = ['dueno', 'gerente', 'supervisor', 'vendedor']

interface PlatformUserActionsProps {
  userId:     string
  userEmail:  string
  userNombre: string
  currentRol: string
  tenantId:   string
  isBanned:   boolean
}

export function PlatformUserActions({
  userId,
  userEmail,
  userNombre,
  currentRol,
  tenantId,
  isBanned,
}: PlatformUserActionsProps) {
  const router = useRouter()

  const [showReactivate,    setShowReactivate]    = useState(false)
  const [showDeactivate,    setShowDeactivate]    = useState(false)
  const [showChangeRole,    setShowChangeRole]    = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [isLoading,         setIsLoading]         = useState(false)
  const [selectedRol,       setSelectedRol]       = useState<AppRole>(
    (ROLES_SELECCIONABLES.includes(currentRol as AppRole) ? currentRol : 'vendedor') as AppRole,
  )

  const displayName = userNombre || userEmail

  async function handleReactivate() {
    setIsLoading(true)
    const result = await reactivateUserAdmin(userId, tenantId)
    setIsLoading(false)
    setShowReactivate(false)
    if (!result.success) { toast.error('No se pudo reactivar', { description: result.error }); return }
    toast.success('Usuario reactivado', { description: `${displayName} puede volver a iniciar sesión.` })
    router.refresh()
  }

  async function handleDeactivate() {
    setIsLoading(true)
    const result = await deactivateUserAdmin(userId, tenantId)
    setIsLoading(false)
    setShowDeactivate(false)
    if (!result.success) { toast.error('No se pudo dar de baja', { description: result.error }); return }
    toast.success('Usuario dado de baja', { description: `${displayName} ya no puede acceder.` })
    router.refresh()
  }

  async function handleChangeRole() {
    setIsLoading(true)
    const result = await changeUserRole(userId, tenantId, selectedRol)
    setIsLoading(false)
    setShowChangeRole(false)
    if (!result.success) { toast.error('No se pudo cambiar el rol', { description: result.error }); return }
    toast.success('Rol actualizado', { description: `${displayName} ahora es ${ROL_LABELS[selectedRol] ?? selectedRol}.` })
    router.refresh()
  }

  async function handleResetPassword() {
    setIsLoading(true)
    const result = await resetUserPasswordAdmin(userEmail)
    setIsLoading(false)
    setShowResetPassword(false)
    if (!result.success) { toast.error('No se pudo enviar el email', { description: result.error }); return }
    toast.success('Email enviado', { description: `Link de recuperación enviado a ${userEmail}.` })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Acciones del usuario"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          {isBanned ? (
            <DropdownMenuItem
              onClick={() => setShowReactivate(true)}
              className="text-emerald-600 focus:text-emerald-700 cursor-pointer"
            >
              <UserCheck className="mr-2 size-4" />
              Reactivar
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => { setSelectedRol((ROLES_SELECCIONABLES.includes(currentRol as AppRole) ? currentRol : 'vendedor') as AppRole); setShowChangeRole(true) }}
                className="cursor-pointer"
              >
                <ShieldCheck className="mr-2 size-4" />
                Cambiar rol
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowResetPassword(true)}
                className="cursor-pointer"
              >
                <KeyRound className="mr-2 size-4" />
                Restablecer contraseña
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeactivate(true)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <UserX className="mr-2 size-4" />
                Dar de baja
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Reactivar */}
      <AlertDialog open={showReactivate} onOpenChange={(o) => { if (!isLoading) setShowReactivate(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar a {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{userEmail}</span> podrá volver a iniciar sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReactivate}
              disabled={isLoading}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isLoading ? <><Loader2 className="mr-1.5 size-4 animate-spin" />Procesando...</> : 'Sí, reactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dar de baja */}
      <AlertDialog open={showDeactivate} onOpenChange={(o) => { if (!isLoading) setShowDeactivate(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja a {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{userEmail}</span> no podrá iniciar sesión
              hasta que reactives su cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? <><Loader2 className="mr-1.5 size-4 animate-spin" />Procesando...</> : 'Sí, dar de baja'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restablecer contraseña */}
      <AlertDialog open={showResetPassword} onOpenChange={(o) => { if (!isLoading) setShowResetPassword(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restablecer contraseña de {displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará un link de recuperación a{' '}
              <span className="font-medium text-foreground">{userEmail}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-1.5 size-4 animate-spin" />Enviando...</> : 'Enviar link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cambiar rol */}
      <Dialog open={showChangeRole} onOpenChange={(o) => { if (!isLoading) setShowChangeRole(o) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar rol de {displayName}</DialogTitle>
            <DialogDescription>
              Rol actual:{' '}
              <span className="font-medium text-foreground">
                {ROL_LABELS[currentRol] ?? currentRol}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Select value={selectedRol} onValueChange={(v) => setSelectedRol(v as AppRole)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES_SELECCIONABLES.map((r) => (
                  <SelectItem key={r} value={r}>{ROL_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowChangeRole(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={isLoading || selectedRol === currentRol}
            >
              {isLoading
                ? <><Loader2 className="mr-1.5 size-4 animate-spin" />Guardando...</>
                : 'Guardar cambio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
