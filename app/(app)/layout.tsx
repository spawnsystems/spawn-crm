import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getCurrentTenant, getCurrentTenantId } from '@/lib/tenant/server'
import { getCurrentUserTeamScope } from '@/lib/tenant/teams'
import { getEnabledModules } from '@/lib/modules/server'
import { TenantProvider } from '@/lib/tenant/context'
import { PreviewBanner } from '@/components/platform/preview-banner'
import { AppSidebar } from '@/components/layout/app-sidebar'
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

  const [scope, modules] = await Promise.all([
    getCurrentUserTeamScope(user.id, tenantId, user.rol),
    getEnabledModules(tenantId),
  ])

  const cookieStore = await cookies()
  const isPreview = user.is_platform_admin && !!cookieStore.get(PREVIEW_COOKIE)?.value

  return (
    <TenantProvider value={{ tenant, user, scope, isPreview, modules }}>
      <div className="flex flex-col min-h-screen">
        {isPreview && <PreviewBanner tenantNombre={tenant.nombre} />}
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          {/* pt-14 on mobile to clear the fixed header; lg removes it (sidebar is static) */}
          <main className="flex-1 min-w-0 overflow-y-auto pt-14 lg:pt-0">
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
