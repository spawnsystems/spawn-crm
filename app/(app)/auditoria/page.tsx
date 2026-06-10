import { requireRole } from '@/lib/auth/require-role'
import { requireModule } from '@/lib/modules/server'
import { getAuditLogs } from '@/app/actions/audit'
import { getMiembrosDelTenant } from '@/app/actions/equipos'
import { AuditTab } from '@/components/config/audit-tab'
import { ScrollText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AuditoriaPage() {
  // Solo dueño (y platform_admin por jerarquía). Gerente/supervisor/vendedor → /
  await requireModule('auditoria')
  await requireRole('dueno')

  const [auditLogs, miembros] = await Promise.all([
    getAuditLogs(),
    getMiembrosDelTenant(),
  ])

  return (
    <div className="p-4 md:p-8 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <ScrollText className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Auditoría</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Registro de actividad de la empresa: quién hizo qué y cuándo.
      </p>

      <AuditTab initialLogs={auditLogs} miembros={miembros} />
    </div>
  )
}
