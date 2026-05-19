import { requireRole } from '@/lib/auth/require-role'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { LayoutDashboard } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireRole('supervisor')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <LayoutDashboard className="size-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenido, <span className="font-medium text-foreground">{user.nombre}</span>.
          <br />Vista de gerente/dueño — en construcción (Fase 6).
        </p>
        <p className="text-xs text-muted-foreground/60">Rol: {user.rol}</p>
      </div>
      <form action={signOut}>
        <Button variant="outline" size="sm">Cerrar sesión</Button>
      </form>
    </main>
  )
}
