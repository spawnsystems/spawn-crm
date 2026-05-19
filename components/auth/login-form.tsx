'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { loginSchema, type LoginInput } from '@/lib/schemas/auth'
import { signIn, requestPasswordReset } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [forgotMode, setForgotMode]     = useState(false)
  const [isPending, startTransition]    = useTransition()

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  // ── Login ──────────────────────────────────────────────────
  const onLogin = handleSubmit((data) => {
    startTransition(async () => {
      const result = await signIn(data)
      if (!result.success) {
        toast.error(result.error)
      }
      // Si tiene éxito, signIn() hace redirect() server-side
    })
  })

  // ── Forgot password ────────────────────────────────────────
  const onForgot = () => {
    const email = getValues('email')
    if (!email) {
      toast.error('Ingresá tu email primero')
      return
    }
    startTransition(async () => {
      const result = await requestPasswordReset(email)
      if (result.success) {
        toast.success('Revisá tu email para resetear la contraseña')
        setForgotMode(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h1 className="mb-6 text-center text-xl font-semibold tracking-tight">
        {forgotMode ? 'Recuperar contraseña' : 'Iniciar sesión'}
      </h1>

      <form onSubmit={onLogin} className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            disabled={isPending}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password — se oculta en modo forgot */}
        {!forgotMode && (
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isPending}
                className="pr-10"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
        )}

        {/* CTA */}
        {forgotMode ? (
          <div className="space-y-2">
            <Button
              type="button"
              className="w-full"
              disabled={isPending}
              onClick={onForgot}
            >
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enviar email de recuperación
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isPending}
              onClick={() => setForgotMode(false)}
            >
              Volver al login
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Ingresar
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              onClick={() => setForgotMode(true)}
            >
              Olvidé mi contraseña
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
