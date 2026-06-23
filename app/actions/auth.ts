'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/schemas/auth'
import { dbAdmin, schema } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

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

  // Bloquear el ingreso de cuentas sin NINGUNA membresía activa (echados o aún no
  // activados), salvo platform_admins. El acceso a datos ya estaba cerrado por el
  // filtro activo=true, pero así ni siquiera llegan a la pantalla "Cuenta pendiente".
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const [perfil] = await dbAdmin
      .select({ is_platform_admin: schema.usuarios.is_platform_admin })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, user.id))
      .limit(1)

    if (!perfil?.is_platform_admin) {
      const activa = await dbAdmin
        .select({ uid: schema.tenantMembers.user_id })
        .from(schema.tenantMembers)
        .where(and(
          eq(schema.tenantMembers.user_id, user.id),
          eq(schema.tenantMembers.activo, true),
        ))
        .limit(1)

      if (activa.length === 0) {
        await supabase.auth.signOut()
        return { success: false, error: 'Tu cuenta no tiene acceso activo. Contactá con tu administrador.' }
      }
    }
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
  const { data, error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { success: false, error: 'No se pudo actualizar la contraseña. Intentá de nuevo.' }
  }

  // Si el usuario venía de una invitación, este es el paso que cierra el
  // onboarding: activamos su membresía pendiente. Solo tocamos invitaciones
  // 'pending' → así un usuario DESACTIVADO que resetea su contraseña NO se
  // reactiva solo (su membresía ya está en 'accepted').
  const userId = data.user?.id
  if (userId) {
    await dbAdmin
      .update(schema.tenantMembers)
      .set({ activo: true, invitation_status: 'accepted' })
      .where(and(
        eq(schema.tenantMembers.user_id, userId),
        eq(schema.tenantMembers.invitation_status, 'pending'),
      ))
  }

  return { success: true, data: undefined }
}
