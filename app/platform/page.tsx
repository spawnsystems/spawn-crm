import { requireRole } from '@/lib/auth/require-role'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlatformPage() {
  const user = await requireRole('platform_admin')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="size-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Platform Admin</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenido, <span className="font-medium text-foreground">{user.nombre}</span>.
          <br />Panel de administración — en construcción (Fase 3).
        </p>
      </div>
      <form action={signOut}>
        <Button variant="outline" size="sm">Cerrar sesión</Button>
      </form>
    </main>
  )
}
