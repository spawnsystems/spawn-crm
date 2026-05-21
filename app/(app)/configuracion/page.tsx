import { requireAuth } from '@/lib/auth/require-role'
import { getCurrentTenant } from '@/lib/tenant/server'
import { getMiembrosDelTenant } from '@/app/actions/equipos'
import { ConfiguracionView } from '@/components/config/configuracion-view'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  const [user, tenant, miembros] = await Promise.all([
    requireAuth(),
    getCurrentTenant(),
    getMiembrosDelTenant(),
  ])

  const canManage = ['platform_admin', 'dueno'].includes(user.rol)

  return (
    <ConfiguracionView
      user={user}
      tenant={tenant}
      miembros={miembros}
      canManage={canManage}
    />
  )
}
