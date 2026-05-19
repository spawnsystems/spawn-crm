import { createServerClient } from '@supabase/ssr'

/**
 * Cliente con service role — bypasea RLS.
 * Solo usar en server actions de /platform, invitaciones y scripts de seed.
 * NUNCA importar en Client Components.
 */
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    },
  )
}
