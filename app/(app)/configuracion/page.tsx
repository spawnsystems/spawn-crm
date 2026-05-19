import { requireAuth } from '@/lib/auth/require-role'
import { getCurrentTenant } from '@/lib/tenant/server'
import { Settings } from 'lucide-react'
import { Card } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  const [user, tenant] = await Promise.all([requireAuth(), getCurrentTenant()])

  return (
    <div className="p-8 max-w-[800px] mx-auto">
      <div className="flex items-center gap-2.5 mb-6">
        <Settings className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
            Mi cuenta
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Nombre</span>
              <span className="font-medium">{user.nombre}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border/50">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">Rol</span>
              <span className="font-medium capitalize">{user.rol}</span>
            </div>
          </div>
        </Card>

        {tenant && (
          <Card className="p-5">
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
              Concesionaria
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">Nombre</span>
                <span className="font-medium">{tenant.nombre}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Marca</span>
                <span className="font-medium">{tenant.concesionaria}</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
