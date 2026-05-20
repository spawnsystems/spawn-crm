'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useCurrentUser, useTenant } from '@/lib/tenant/context'
import { signOut } from '@/app/actions/auth'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useState, useTransition } from 'react'

// ── Nav items by role ─────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: string[] // which roles see this item
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="size-4" />,
    roles: ['platform_admin', 'dueno', 'gerente', 'supervisor'],
  },
  {
    href: '/all-leads',
    label: 'Todos los Leads',
    icon: <Users2 className="size-4" />,
    roles: ['platform_admin', 'dueno', 'gerente', 'supervisor'],
  },
  {
    href: '/equipo',
    label: 'Equipo',
    icon: <Trophy className="size-4" />,
    roles: ['platform_admin', 'dueno', 'gerente', 'supervisor'],
  },
  {
    href: '/rescate',
    label: 'Rescate',
    icon: <LifeBuoy className="size-4" />,
    roles: ['platform_admin', 'dueno', 'gerente'],
  },
  {
    href: '/leads',
    label: 'Mis Leads',
    icon: <Users className="size-4" />,
    roles: ['platform_admin', 'dueno', 'gerente', 'supervisor', 'vendedor'],
  },
  {
    href: '/pipeline',
    label: 'Pipeline',
    icon: <GitBranch className="size-4" />,
    roles: ['platform_admin', 'dueno', 'gerente', 'supervisor', 'vendedor'],
  },
  {
    href: '/performance',
    label: 'Mi Performance',
    icon: <TrendingUp className="size-4" />,
    roles: ['vendedor'],
  },
]

// ── SidebarContent ─────────────────────────────────────────────────
// Shared content — used inside both desktop aside and mobile Sheet

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const user = useCurrentUser()
  const tenant = useTenant()
  const [isPending, startTransition] = useTransition()

  const initials = user.nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.rol))

  return (
    <div className="flex h-full flex-col">
      {/* Logo / Tenant */}
      <div className="flex h-16 items-center justify-center border-b border-border px-4 shrink-0">
        {tenant.logo_url ? (
          <img
            src={tenant.logo_url}
            alt={tenant.nombre}
            className="max-h-10 max-w-[180px] w-full object-contain"
            style={{ mixBlendMode: 'multiply' }}
          />
        ) : (
          <div className="flex items-center gap-2.5 w-full">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border">
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
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
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                  )}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="size-3 text-primary/50" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Settings */}
      <div className="px-2 pb-2">
        <Link
          href="/configuracion"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-4 shrink-0" />
          Configuración
        </Link>
      </div>

      {/* User footer */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-tight">{user.alias || user.nombre}</div>
            <div className="truncate text-[10px] capitalize text-muted-foreground">{user.rol}</div>
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

// ── Component ─────────────────────────────────────────────────────

export function AppSidebar() {
  const [open, setOpen] = useState(false)
  const tenant = useTenant()
  const user = useCurrentUser()

  const initials = user.nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile: header bar + Sheet drawer */}
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

        {/* Tenant name in header */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.nombre}
              className="max-h-6 max-w-[120px] object-contain shrink-0"
              style={{ mixBlendMode: 'multiply' }}
            />
          ) : (
            <>
              <div className="flex size-6 shrink-0 items-center justify-center rounded border border-border">
                <span className="text-[8px] font-bold text-muted-foreground">
                  {tenant.concesionaria.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-semibold truncate">{tenant.nombre}</span>
            </>
          )}
        </div>

        {/* User initials chip */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
          {initials}
        </div>
      </div>
    </>
  )
}
