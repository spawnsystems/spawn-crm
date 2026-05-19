import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Crea un cliente Supabase para Server Components, Server Actions y Route Handlers.
 * Siempre crear una instancia nueva por función — no guardar en variable global.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Ignorar si se llama desde un Server Component (sin capacidad de setear cookies).
            // El proxy.ts se encarga de refrescar la sesión.
          }
        },
      },
    },
  )
}
