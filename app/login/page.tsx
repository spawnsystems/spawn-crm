import { LoginForm } from '@/components/auth/login-form'
import Image from 'next/image'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/spawn-logo.png"
            alt="Spawn CRM"
            width={140}
            height={40}
            priority
            className="dark:invert"
          />
          <p className="text-sm text-muted-foreground">
            CRM para concesionarios
          </p>
        </div>

        {/* Formulario */}
        <LoginForm />
      </div>
    </main>
  )
}
