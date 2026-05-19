import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenant, getCurrentTenantId } from '@/lib/tenant/server'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'
import { TenantProvider } from '@/lib/tenant/context'
import { PreviewBanner } from '@/components/platform/preview-banner'
import { cookies } from 'next/headers'
import { PREVIEW_COOKIE } from '@/lib/constants'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  // Platform admin sin preview → va a /platform
  if (user.is_platform_admin) {
    const cookieStore = await cookies()
    const isPreview = !!cookieStore.get(PREVIEW_COOKIE)?.value
    if (!isPreview) redirect('/platform')
  }

  const [tenant, tenantId] = await Promise.all([
    getCurrentTenant(),
    getCurrentTenantId(),
  ])

  if (!tenant || !tenantId) {
    // Usuario sin tenant asignado — mostrar página de espera
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold">Cuenta pendiente</h1>
          <p className="text-sm text-muted-foreground">
            Tu acceso aún no fue activado. Contactá con tu administrador.
          </p>
        </div>
      </main>
    )
  }

  const scope = await getCurrentUserTeamScope(user.id, tenantId, user.rol)

  const cookieStore = await cookies()
  const isPreview = user.is_platform_admin && !!cookieStore.get(PREVIEW_COOKIE)?.value

  return (
    <TenantProvider value={{ tenant, user, scope, isPreview }}>
      {isPreview && <PreviewBanner tenantNombre={tenant.nombre} />}
      {children}
    </TenantProvider>
  )
}
