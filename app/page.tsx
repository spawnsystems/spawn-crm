import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/get-current-user'

export const dynamic = 'force-dynamic'

/**
 * Raíz de la app — redirige al destino correcto según rol.
 * El proxy.ts ya garantiza que el usuario está autenticado.
 */
export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  if (user.is_platform_admin) redirect('/platform')

  switch (user.rol) {
    case 'dueno':
    case 'gerente':
    case 'supervisor':
      redirect('/dashboard')
    case 'vendedor':
    default:
      redirect('/leads')
  }
}
