'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/schemas/auth'

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// ── Login ─────────────────────────────────────────────────────
export async function signIn(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email:    parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Supabase devuelve mensajes en inglés — los traducimos
    if (error.message.includes('Invalid login credentials')) {
      return { success: false, error: 'Email o contraseña incorrectos' }
    }
    if (error.message.includes('Email not confirmed')) {
      return { success: false, error: 'Confirmá tu email antes de ingresar' }
    }
    return { success: false, error: 'Error al iniciar sesión. Intentá de nuevo.' }
  }

  redirect('/')
}

// ── Sign Out ──────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ── Reset Password (olvidé contraseña) ───────────────────────
export async function requestPasswordReset(
  email: string,
): Promise<ActionResult<void>> {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Email inválido' }
  }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/update-password`,
  })

  if (error) {
    return { success: false, error: 'No se pudo enviar el email. Intentá de nuevo.' }
  }

  return { success: true, data: undefined }
}

// ── Update Password (post-invitación o reset) ─────────────────
export async function updatePassword(
  password: string,
): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { success: false, error: 'No se pudo actualizar la contraseña. Intentá de nuevo.' }
  }

  return { success: true, data: undefined }
}
