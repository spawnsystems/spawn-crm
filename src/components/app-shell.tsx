import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Users, BarChart3, Settings, Inbox, Kanban,
  TrendingUp, UsersRound, ChevronsUpDown, Search, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export type Role = "vendedor" | "gerente";
export type SellerScreen = "leads" | "pipeline" | "performance" | "config";
export type ManagerScreen = "dashboard" | "all-leads" | "team" | "reports" | "config";

const sellerNav: { id: SellerScreen; label: string; icon: any }[] = [
  { id: "leads", label: "Mis Leads", icon: Inbox },
  { id: "pipeline", label: "Pipeline", icon: Kanban },
  { id: "performance", label: "Mi Performance", icon: TrendingUp },
  { id: "config", label: "Configuración", icon: Settings },
];

const managerNav: { id: ManagerScreen; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "all-leads", label: "Todos los Leads", icon: Users },
  { id: "team", label: "Equipo", icon: UsersRound },
  { id: "reports", label: "Reportes", icon: BarChart3 },
  { id: "config", label: "Configuración", icon: Settings },
];

interface Props {
  role: Role;
  setRole: (r: Role) => void;
  screen: string;
  setScreen: (s: any) => void;
  children: ReactNode;
}

export function AppShell({ role, setRole, screen, setScreen, children }: Props) {
  const nav = role === "vendedor" ? sellerNav : managerNav;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">S</div>
            <div>
              <div className="text-base font-semibold tracking-tight text-white">Spawn</div>
              <div className="text-[11px] text-sidebar-foreground/60 -mt-0.5">CRM Concesionario</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <div className="px-2 pb-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">
            {role === "vendedor" ? "Vendedor" : "Gerente"}
          </div>
          {nav.map((item) => {
            const active = screen === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">JM</div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-white truncate">Jorge Méndez</div>
              <div className="text-[10px] text-sidebar-foreground/50 truncate">Chevrolet Centro</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card/50 backdrop-blur px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>Buscar leads, vendedores, modelos...</span>
            <kbd className="ml-2 hidden md:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8">
                  <span className={cn("h-1.5 w-1.5 rounded-full", role === "vendedor" ? "bg-primary" : "bg-success")} />
                  {role === "vendedor" ? "Vista Vendedor" : "Vista Gerente"}
                  <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Cambiar de rol</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setRole("vendedor"); setScreen("leads"); }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary mr-2" />
                  Vista Vendedor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRole("gerente"); setScreen("dashboard"); }}>
                  <span className="h-1.5 w-1.5 rounded-full bg-success mr-2" />
                  Vista Gerente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main key={`${role}-${screen}`} className="flex-1 overflow-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
