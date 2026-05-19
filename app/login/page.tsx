'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft, Mail } from 'lucide-react'

import { loginSchema, type LoginInput } from '@/lib/schemas/auth'
import { requestPasswordReset } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Mapeador de errores de Supabase ───────────────────────────
function mapError(message: string): { title: string; description: string } {
  const msg = message.toLowerCase()
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password'))
    return { title: 'Credenciales incorrectas', description: 'El email o la contraseña no coinciden.' }
  if (msg.includes('email not confirmed'))
    return { title: 'Email sin verificar', description: 'Confirmá tu email antes de ingresar.' }
  if (msg.includes('too many requests') || msg.includes('rate limit'))
    return { title: 'Demasiados intentos', description: 'Esperá unos minutos antes de reintentar.' }
  if (msg.includes('network') || msg.includes('fetch'))
    return { title: 'Sin conexión', description: 'No se pudo contactar con el servidor.' }
  return { title: 'Error inesperado', description: message || 'Intentá de nuevo.' }
}

// ── Shell con fondo y glow ─────────────────────────────────────
function AuthShell({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </main>
  )
}

function SpawnWordmark() {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/spawn-logo.png" alt="Spawn CRM" className="h-28 w-auto" />
    </div>
  )
}

function AuthFooter() {
  return (
    <p className="mt-8 text-center text-[11px] text-muted-foreground/40 tracking-wide">
      SPAWN · CRM PARA CONCESIONARIOS
    </p>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [view, setView] = useState<'login' | 'forgot'>('login')
  const [forgotEmail, setForgotEmail] = useState('')
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) toast.error('Error de autenticación', { description: decodeURIComponent(error) })
  }, [searchParams])

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    const supabase = createClient()
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email:    values.email,
        password: values.password,
      })
      if (error) {
        const { title, description } = mapError(error.message)
        toast.error(title, { description })
        return
      }
      toast.success('Acceso concedido', {
        description: 'Bienvenido de vuelta.',
        icon: <ShieldCheck className="size-4 text-primary" />,
      })
      router.push('/')
      router.refresh()
    } catch {
      toast.error('Sin conexión al servidor', {
        description: 'Verificá tu red e intentá de nuevo.',
      })
    }
  }

  async function handleForgotPassword() {
    if (!forgotEmail.includes('@')) {
      toast.error('Email inválido', { description: 'Ingresá un email válido.' })
      return
    }
    setIsSendingReset(true)
    try {
      const result = await requestPasswordReset(forgotEmail)
      if (!result.success) {
        toast.error('No se pudo enviar el email', { description: result.error })
        return
      }
      setResetSent(true)
    } catch {
      toast.error('Error de conexión', { description: 'No se pudo contactar con el servidor.' })
    } finally {
      setIsSendingReset(false)
    }
  }

  // ── Vista: Recuperar contraseña ───────────────────────────────
  if (view === 'forgot') {
    return (
      <AuthShell>
        <SpawnWordmark />
        <div className="mt-10 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 shadow-lg shadow-black/5 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Mail className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold leading-tight">
                {resetSent ? 'Email enviado' : 'Recuperar contraseña'}
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                {resetSent
                  ? `Revisá ${forgotEmail}`
                  : 'Te mandamos un link para elegir una nueva contraseña.'}
              </p>
            </div>
          </div>

          {resetSent ? (
            <div className="space-y-4">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Si no aparece en unos minutos, revisá la carpeta de spam.
              </p>
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl text-[13px] border-border/60"
                onClick={() => { setView('login'); setResetSent(false); setForgotEmail('') }}
              >
                <ArrowLeft className="mr-2 size-4" /> Volver al login
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="nombre@ejemplo.com"
                  autoComplete="email"
                  autoFocus
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleForgotPassword() }}
                  className="h-11 rounded-xl bg-secondary/50 border-border/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15"
                />
              </div>
              <Button
                type="button"
                disabled={isSendingReset || !forgotEmail}
                className="h-11 w-full rounded-xl font-semibold"
                onClick={handleForgotPassword}
              >
                {isSendingReset
                  ? <><Loader2 className="mr-2 size-4 animate-spin" /> Enviando...</>
                  : 'Enviar link de recuperación'}
              </Button>
              <button
                type="button"
                className="w-full text-[12px] text-muted-foreground hover:text-foreground transition-colors text-center flex items-center justify-center gap-1.5"
                onClick={() => { setView('login'); setForgotEmail('') }}
              >
                <ArrowLeft className="size-3" /> Volver al login
              </button>
            </div>
          )}
        </div>
        <AuthFooter />
      </AuthShell>
    )
  }

  // ── Vista: Login ──────────────────────────────────────────────
  return (
    <AuthShell>
      <SpawnWordmark />

      <div className="mt-10 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 shadow-lg shadow-black/5 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="nombre@ejemplo.com"
              autoComplete="email"
              autoFocus
              aria-invalid={!!errors.email}
              className="h-11 rounded-xl bg-secondary/50 border-border/60 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-[11px] text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
                Contraseña
              </Label>
              <button
                type="button"
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setForgotEmail(getValues('email') ?? ''); setView('forgot') }}
              >
                ¿Olvidaste la tuya?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className="h-11 rounded-xl bg-secondary/50 border-border/60 pr-10 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/15"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 h-11 w-full rounded-xl font-semibold shadow-sm shadow-primary/20 active:scale-[0.98] transition-transform"
          >
            {isSubmitting
              ? <><Loader2 className="mr-2 size-4 animate-spin" /> Autenticando...</>
              : 'Ingresar'}
          </Button>
        </form>
      </div>

      <AuthFooter />
    </AuthShell>
  )
}
