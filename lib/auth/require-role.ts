import { redirect } from 'next/navigation'
import { getCurrentUser, type AppRole } from './get-current-user'

const ROLE_RANK: Record<AppRole, number> = {
  platform_admin: 5,
  dueno:          4,
  gerente:        3,
  supervisor:     2,
  vendedor:       1,
}

/**
 * Guard para Server Components y Server Actions.
 * Redirige a /login si no hay sesión.
 * Redirige a / si el rol del usuario es menor al requerido.
 *
 * @example
 * // Solo dueños y admins pueden entrar
 * const user = await requireRole('dueno')
 */
export async function requireRole(minRole: AppRole) {
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  if (ROLE_RANK[user.rol] < ROLE_RANK[minRole]) {
    redirect('/')
  }

  return user
}

/**
 * Solo verifica autenticación, sin restricción de rol.
 * Redirige a /login si no hay sesión.
 */
export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}
