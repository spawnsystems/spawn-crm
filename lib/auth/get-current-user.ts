import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { dbAdmin, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

export type AppRole = 'platform_admin' | 'dueno' | 'gerente' | 'supervisor' | 'vendedor'

export interface CurrentUser {
  id: string
  email: string
  nombre: string
  alias: string | null
  rol: AppRole
  is_platform_admin: boolean
}

/**
 * Retorna el usuario autenticado actual con su perfil de la tabla `usuarios`.
 * Cacheado con React.cache() — una sola query por render, aunque se llame
 * desde layout + page + múltiples Server Components.
 *
 * Server-only. NUNCA importar en Client Components.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) return null

  const rows = await dbAdmin
    .select({
      id:                schema.usuarios.id,
      email:             schema.usuarios.email,
      nombre:            schema.usuarios.nombre,
      alias:             schema.usuarios.alias,
      rol:               schema.usuarios.rol,
      is_platform_admin: schema.usuarios.is_platform_admin,
    })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.id, user.id))
    .limit(1)

  const usuario = rows[0]
  if (!usuario) return null

  return {
    id:                usuario.id,
    email:             usuario.email,
    nombre:            usuario.nombre,
    alias:             usuario.alias,
    rol:               usuario.rol as AppRole,
    is_platform_admin: usuario.is_platform_admin,
  }
})

/**
 * Solo el rol, o null si no está logueado.
 */
export const getCurrentUserRole = cache(async (): Promise<AppRole | null> => {
  const user = await getCurrentUser()
  return user?.rol ?? null
})
