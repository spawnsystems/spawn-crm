'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCurrentUser, useTenant } from '@/lib/tenant/context'
import { signOut } from '@/app/actions/auth'
import { getUnreadCount } from '@/app/actions/notifications'
import {
  LayoutDashboard,
  Users,
  Users2,
  GitBranch,
  TrendingUp,
  LifeBuoy,
  Trophy,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  CalendarDays,
  Inbox,
  Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useState, useTransition, useEffect, useCallback } from 'react'

// ── Data ──────────────────────────────────────────────────────────

interface NavItem {
  href:    string
  label:   string
  icon:    React.ReactNode
  roles:   string[]
  section: string
  badge?:  boolean  // si true, mostrará el badge de notificaciones
}

// Sections define the visual groups — rendered only if they have
// at least one visible item for the current user's role.
const SECTIONS = [
  { id: 'analisis',  label: 'Análisis'  },
  { id: 'leads',     label: 'Leads'     },
  { id: 'actividad', label: 'Actividad' },
  { id: 'equipo',    label: 'Equipo'    },
] as const

const NAV_ITEMS: NavItem[] = [
  // ── Análisis ────────────────────────────────────────────────
  {
    href:    '/dashboard',
    label:   'Dashboard',
    icon:    <LayoutDashboard className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor'],
    section: 'analisis',
  },
  {
    href:    '/performance',
    label:   'Mi Performance',
    icon:    <TrendingUp className="size-4" />,
    roles:   ['vendedor'],
    section: 'analisis',
  },
  // ── Leads ───────────────────────────────────────────────────
  {
    href:    '/all-leads',
    label:   'Todos los Leads',
    icon:    <Users2 className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor'],
    section: 'leads',
  },
  {
    href:    '/leads',
    label:   'Mis Leads',
    icon:    <Users className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor', 'vendedor'],
    section: 'leads',
  },
  {
    href:    '/rescate',
    label:   'Rescate',
    icon:    <LifeBuoy className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor'],
    section: 'leads',
  },
  {
    href:    '/historial',
    label:   'Historial',
    icon:    <Archive className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor', 'vendedor'],
    section: 'leads',
  },
  {
    href:    '/bandeja',
    label:   'Bandeja',
    icon:    <Inbox className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor', 'vendedor'],
    section: 'leads',
    badge:   true,
  },
  // ── Actividad ────────────────────────────────────────────────
  {
    href:    '/citas',
    label:   'Citas',
    icon:    <CalendarDays className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor', 'vendedor'],
    section: 'actividad',
  },
  {
    href:    '/pipeline',
    label:   'Pipeline',
    icon:    <GitBranch className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor', 'vendedor'],
    section: 'actividad',
  },
  // ── Equipo ───────────────────────────────────────────────────
  {
    href:    '/equipo',
    label:   'Equipo',
    icon:    <Trophy className="size-4" />,
    roles:   ['platform_admin', 'dueno', 'gerente', 'supervisor'],
    section: 'equipo',
  },
]

// ── NotificationBadge ──────────────────────────────────────────────
// Badge que hace polling cada 60s para mostrar el conteo de novedades.

function NotificationBadge() {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const n = await getUnreadCount()
      setCount(n)
    } catch {
      // silencioso — no interrumpe la navegación
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  if (count === 0) return null

  return (
    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none shrink-0">
      {count > 9 ? '9+' : count}
    </span>
  )
}

// ── SidebarContent ─────────────────────────────────────────────────
// Shared between desktop aside and mobile Sheet — pass onNavigate to
// close the Sheet after a tap on mobile.

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const user     = useCurrentUser()
  const tenant   = useTenant()
  const [isPending, startTransition] = useTransition()

  const initials = user.nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Pre-filter items by role once
  const itemsByRole = NAV_ITEMS.filter((item) => item.roles.includes(user.rol))

  // Build visible sections (only sections with ≥ 1 item)
  const visibleSections = SECTIONS
    .map((section) => ({
      ...section,
      items: itemsByRole.filter((item) => item.section === section.id),
    }))
    .filter((s) => s.items.length > 0)

  return (
    <div className="flex h-full flex-col">

      {/* ── Logo / Tenant ── */}
      <div className="flex h-16 items-center border-b border-border px-4 shrink-0">
        {tenant.logo_url ? (
          <img
            src={tenant.logo_url}
            alt={tenant.nombre}
            className="max-h-9 max-w-[160px] w-full object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        ) : (
          <div className="flex items-center gap-2.5 w-full min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
              <span className="text-[10px] font-bold text-muted-foreground">
                {tenant.concesionaria.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">{tenant.nombre}</div>
              <div className="truncate text-[10px] text-muted-foreground">{tenant.concesionaria}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Nav with sections ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {visibleSections.map((section, sectionIdx) => (
          <div key={section.id} className={cn(sectionIdx > 0 && 'pt-3')}>
            {/* Section divider (not shown for the very first section) */}
            {sectionIdx > 0 && (
              <div className="mx-1 mb-3 border-t border-border/60" />
            )}

            {/* Section label */}
            <div className="px-3 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
                {section.label}
              </span>
            </div>

            {/* Items */}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <span className={cn(
                        'shrink-0 transition-colors',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-foreground',
                      )}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && <NotificationBadge />}
                      {isActive && !item.badge && (
                        <ChevronRight className="size-3 text-primary/50 shrink-0" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Configuración ── */}
      <div className="px-2 pb-2">
        <div className="border-t border-border/60 mb-2" />
        <Link
          href="/configuracion"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/configuracion')
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Settings className="size-4 shrink-0" />
          <span className="flex-1">Configuración</span>
          {pathname.startsWith('/configuracion') && (
            <ChevronRight className="size-3 text-primary/50 shrink-0" />
          )}
        </Link>
      </div>

      {/* ── User footer ── */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-tight">
              {user.alias || user.nombre}
            </div>
            <div className="truncate text-[10px] capitalize text-muted-foreground">
              {user.rol}
            </div>
          </div>
          <form
            action={signOut}
            onSubmit={(e) => {
              e.preventDefault()
              startTransition(() => { signOut() })
            }}
          >
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
              disabled={isPending}
              title="Cerrar sesión"
            >
              <LogOut className="size-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── AppSidebar ─────────────────────────────────────────────────────

export function AppSidebar() {
  const [open,  setOpen]  = useState(false)
  const tenant            = useTenant()
  const user              = useCurrentUser()

  const initials = user.nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile: top header bar + Sheet drawer */}
      <div className="lg:hidden flex items-center h-14 border-b border-border bg-card px-4 fixed top-0 inset-x-0 z-40">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 -ml-1 mr-3">
              <Menu className="size-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Tenant identity */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.nombre}
              className="max-h-6 max-w-[110px] object-contain shrink-0"
              style={{ mixBlendMode: 'multiply' }}
            />
          ) : (
            <>
              <div className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-muted/40">
                <span className="text-[8px] font-bold text-muted-foreground">
                  {tenant.concesionaria.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-semibold truncate">{tenant.nombre}</span>
            </>
          )}
        </div>

        {/* User avatar chip */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
          {initials}
        </div>
      </div>
    </>
  )
}
