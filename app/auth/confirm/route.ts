import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'

/**
 * /auth/confirm
 * Maneja el token_hash de los emails de invitación y recovery.
 * Supabase incluye token_hash + type en el link del email.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const code       = searchParams.get('code')
  const next       = searchParams.get('next') ?? '/'

  const supabase = await createClient()

  // Formato recomendado (SSR): el email trae token_hash + type.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      // Invitaciones y recovery → setear contraseña
      if (type === 'invite' || type === 'recovery') {
        return NextResponse.redirect(`${origin}/update-password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Fallback: algunos templates/flows llegan con ?code (PKCE). Esta ruta solo
  // se usa para invitación/recovery, así que tras canjear vamos a /update-password.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/update-password`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`)
}
