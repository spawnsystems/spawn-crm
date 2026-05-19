'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { updatePasswordSchema, type UpdatePasswordInput } from '@/lib/schemas/auth'
import { updatePassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Image from 'next/image'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
  })

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await updatePassword(data.password)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setDone(true)
      toast.success('Contraseña actualizada')
      setTimeout(() => router.push('/'), 1500)
    })
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/spawn-logo.png"
            alt="Spawn CRM"
            width={140}
            height={40}
            priority
            className="dark:invert"
          />
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="mb-2 text-center text-xl font-semibold tracking-tight">
            Crear contraseña
          </h1>
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Elegí una contraseña segura para tu cuenta.
          </p>

          {done ? (
            <p className="text-center text-sm text-muted-foreground">
              Redirigiendo...
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  disabled={isPending}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repetí la contraseña"
                  disabled={isPending}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Guardar contraseña
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
