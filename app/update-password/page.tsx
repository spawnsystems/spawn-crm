'use client'

import { Suspense, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, KeyRound, Eye, EyeOff, Check } from 'lucide-react'

import { updatePasswordSchema, type UpdatePasswordInput } from '@/lib/schemas/auth'
import { updatePassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Reglas de la contraseña (espejo del updatePasswordSchema) ──
const PASSWORD_RULES = [
  { label: '8 caracteres mínimo',     test: (p: string) => p.length >= 8 },
  { label: 'Al menos una mayúscula',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Al menos un número',      test: (p: string) => /[0-9]/.test(p) },
]

// ── Indicador de fortaleza en tiempo real ──────────────────────
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length
  const color =
    passed <= 1 ? 'bg-destructive' : passed === 2 ? 'bg-amber-500' : 'bg-success'

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= passed ? color : 'bg-secondary'
            }`}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {PASSWORD_RULES.map(({ label, test }) => {
          const ok = test(password)
          return (
            <div key={label} className="flex items-center gap-1.5">
              <Check className={`size-3 transition-colors ${ok ? 'text-success' : 'text-muted-foreground/40'}`} />
              <span className={`text-[11px] transition-colors ${ok ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  )
}

function UpdatePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isRecovery = searchParams.get('mode') === 'recovery'

  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    mode: 'onChange',
  })

  const passwordValue = watch('password') ?? ''

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await updatePassword(data.password)
      if (!result.success) {
        toast.error('Error', { description: result.error })
        return
      }
      setDone(true)
      toast.success(isRecovery ? 'Contraseña actualizada' : 'Cuenta activada')
      setTimeout(() => { router.push('/'); router.refresh() }, 1500)
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
              <h2 className="text-[15px] font-semibold leading-tight">
                {isRecovery ? 'Nueva contraseña' : 'Creá tu contraseña'}
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                {isRecovery
                  ? 'Elegí una contraseña segura para recuperar tu acceso.'
                  : 'Elegí una contraseña segura para activar tu cuenta.'}
              </p>
            </div>
          </div>

          {done ? (
            <p className="text-center text-[13px] text-muted-foreground py-2">
              Redirigiendo...
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              {/* Nueva contraseña */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {isRecovery ? 'Nueva contraseña' : 'Contraseña'}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Mínimo 8 caracteres"
                    autoFocus
                    disabled={isPending}
                    aria-invalid={!!errors.password}
                    className="h-11 rounded-xl bg-secondary/50 border-border/60 pr-10 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="text-[11px] text-destructive">{errors.password.message}</p>
                ) : (
                  <PasswordStrength password={passwordValue} />
                )}
              </div>

              {/* Confirmar contraseña */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Confirmar contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repetí la contraseña"
                    disabled={isPending}
                    aria-invalid={!!errors.confirmPassword}
                    className="h-11 rounded-xl bg-secondary/50 border-border/60 pr-10 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15"
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
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
                  ? <><Loader2 className="mr-2 size-4 animate-spin" /> {isRecovery ? 'Guardando...' : 'Activando cuenta...'}</>
                  : (isRecovery ? 'Guardar contraseña' : 'Activar mi cuenta')}
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
