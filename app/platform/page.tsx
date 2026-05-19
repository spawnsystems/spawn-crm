import { requireRole } from '@/lib/auth/require-role'
import { signOut } from '@/app/actions/auth'
import { enterPreviewMode } from '@/app/actions/platform'
import { dbAdmin, schema } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Eye, Building2, CheckCircle2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlatformPage() {
  const user = await requireRole('platform_admin')

  const tenants = await dbAdmin
    .select()
    .from(schema.tenants)
    .orderBy(schema.tenants.created_at)

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
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

      {/* Contenido */}
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tenants ({tenants.length})</h2>
        </div>

        {tenants.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-12 text-center">
            <Building2 className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay tenants creados aún.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className="flex items-center justify-between rounded-xl border bg-card px-5 py-4"
              >
                <div className="flex items-center gap-4">
                  {/* Color del tenant */}
                  <div
                    className="size-8 rounded-lg shrink-0"
                    style={{ backgroundColor: tenant.color_primario ?? '#2563eb' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tenant.nombre}</span>
                      {tenant.activo
                        ? <CheckCircle2 className="size-3.5 text-emerald-500" />
                        : <XCircle className="size-3.5 text-destructive" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tenant.concesionaria} · {tenant.plan_key}
                    </p>
                  </div>
                </div>

                <form
                  action={async () => {
                    'use server'
                    await enterPreviewMode(tenant.id)
                  }}
                >
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Eye className="size-3.5" />
                    Preview
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
