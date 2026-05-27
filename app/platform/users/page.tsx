import { requireRole } from '@/lib/auth/require-role'
import { fetchAllUsers } from '@/app/actions/platform'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { UserTable } from './_components/user-table'
import { InviteUserDialog } from './_components/invite-user-dialog'

export const dynamic = 'force-dynamic'

export default async function PlatformUsersPage() {
  const user  = await requireRole('platform_admin')
  const users = await fetchAllUsers()

  return (
    <main className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="border-b bg-card px-6 py-4 sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Platform Admin</h1>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <form action={signOut}>
            <Button variant="outline" size="sm">Cerrar sesión</Button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* ── Nav tabs ── */}
        <div className="flex gap-0 border-b -mt-2">
          <Link
            href="/platform"
            className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Concesionarias
          </Link>
          <Link
            href="/platform/users"
            className="px-4 py-2.5 text-sm font-medium text-foreground border-b-2 border-primary -mb-px"
          >
            Usuarios
          </Link>
        </div>

        {/* ── Título + botón ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Usuarios</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
            </p>
          </div>
          <InviteUserDialog />
        </div>

        <UserTable users={users} />
      </div>
    </main>
  )
}
