'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Crea un cliente Supabase para Client Components.
 * Usar cuando se necesite el cliente en el browser (SWR, listeners de auth, etc.)
 */
export function createClient() {
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey!,
  )
}
