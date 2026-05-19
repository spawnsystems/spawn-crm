'use client'

/**
 * lib/tenant/context.tsx
 * Contexto React para datos del tenant y usuario actual.
 * Se provee desde el layout (app)/(app)/layout.tsx y se consume
 * en Client Components vía hooks.
 */

import { createContext, useContext } from 'react'
import type { TenantData } from './server'
import type { CurrentUser } from '@/lib/auth/get-current-user'
import type { TeamScope } from './teams'

// ── Tipos ─────────────────────────────────────────────────────

interface TenantContextValue {
  tenant:    TenantData
  user:      CurrentUser
  scope:     TeamScope
  isPreview: boolean
}

// ── Context ───────────────────────────────────────────────────

const TenantContext = createContext<TenantContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────

export function TenantProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: TenantContextValue
}) {
  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

// ── Hooks ──────────────────────────────────────────────────────

function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenantContext: debe estar dentro de <TenantProvider>')
  return ctx
}

/** Datos del tenant activo. */
export function useTenant(): TenantData {
  return useTenantContext().tenant
}

/** Usuario autenticado con su rol y perfil. */
export function useCurrentUser(): CurrentUser {
  return useTenantContext().user
}

/** Scope de visibilidad de leads del usuario actual. */
export function useTeamScope(): TeamScope {
  return useTenantContext().scope
}

/** True si el platform admin está en modo preview de un tenant. */
export function useIsPreview(): boolean {
  return useTenantContext().isPreview
}

/** Verifica si el usuario puede ver un lead específico por su equipo/asignación. */
export function useCanSeeLead(lead: { assigned_to: string | null; equipo_id: string | null }): boolean {
  const { scope } = useTenantContext()

  switch (scope.type) {
    case 'all':    return true
    case 'teams':  return lead.equipo_id !== null && scope.equipoIds.includes(lead.equipo_id)
    case 'team':   return lead.equipo_id === scope.equipoId
    case 'self':   return lead.assigned_to === null || lead.assigned_to === scope.userId
    case 'none':   return false
  }
}

export type { TenantContextValue }
