'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, KeyRound } from 'lucide-react'

import { updatePasswordSchema, type UpdatePasswordInput } from '@/lib/schemas/auth'
import { updatePassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({ resolver: zodResolver(updatePasswordSchema) })

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await updatePassword(data.password)
      if (!result.success) {
        toast.error('Error', { description: result.error })
        return
      }
      setDone(true)
      toast.success('Contraseña actualizada')
      setTimeout(() => router.push('/'), 1500)
    })
  })

  return (
    <main className="relative min-h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh]"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, hsl(var(--primary) / 0.12), transparent)',
        }}
      />
      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/spawn-logo.png" alt="Spawn CRM" className="h-28 w-auto" />
        </div>

        <div className="mt-10 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 shadow-lg shadow-black/5 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <KeyRound className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold leading-tight">Crear contraseña</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                Elegí una contraseña segura para tu cuenta.
              </p>
            </div>
          </div>

          {done ? (
            <p className="text-center text-[13px] text-muted-foreground py-2">
              Redirigiendo...
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Nueva contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  autoFocus
                  disabled={isPending}
                  className="h-11 rounded-xl bg-secondary/50 border-border/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-[11px] text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Confirmar contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repetí la contraseña"
                  disabled={isPending}
                  className="h-11 rounded-xl bg-secondary/50 border-border/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-[11px] text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isPending}
                className="mt-1 h-11 w-full rounded-xl font-semibold shadow-sm shadow-primary/20 active:scale-[0.98] transition-transform"
              >
                {isPending
                  ? <><Loader2 className="mr-2 size-4 animate-spin" /> Guardando...</>
                  : 'Guardar contraseña'}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground/40 tracking-wide">
          SPAWN · CRM PARA CONCESIONARIOS
        </p>
      </div>
    </main>
  )
}
