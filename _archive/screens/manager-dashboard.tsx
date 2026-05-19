import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { managerKpis, trendData, sellers, sourceData, alerts } from "@/lib/mock-data";
import { ArrowDown, ArrowUp, AlertTriangle, Clock, TrendingUp, Target, AlertOctagon, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export function ManagerDashboard() {
  return (
    <div className="p-8 max-w-[1500px] mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Resumen general · Mayo 2026</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          Actualizado hace 2 min
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <BigKpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Leads del mes"
          value={managerKpis.monthLeads.toString()}
          delta={`+${managerKpis.monthLeadsDelta}%`}
          positive
          sub="vs mes anterior"
        />
        <BigKpi
          icon={<Target className="h-4 w-4" />}
          label="Tasa de conversión"
          value={`${managerKpis.conversionRate}%`}
          delta={`+${managerKpis.conversionDelta}%`}
          positive
          sub="vs mes anterior"
        />
        <BigKpi
          icon={<Clock className="h-4 w-4" />}
          label="Tiempo promedio de respuesta"
          value={`${managerKpis.avgResponseMin} min`}
          delta={`${managerKpis.avgResponseDelta} min`}
          positive
          sub="más rápido vs mes anterior"
        />
        <BigKpi
          icon={<AlertOctagon className="h-4 w-4" />}
          label="Leads en riesgo ahora"
          value={managerKpis.atRiskNow.toString()}
          sub="sin contacto +24h"
          accent="destructive"
        />
      </div>

      {/* Chart */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold">Leads recibidos vs cerrados</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Últimos 30 días</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Recibidos</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Cerrados</span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.14 232)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.72 0.14 232)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.16 152)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.65 0.16 152)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.006 250)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.5 0.015 250)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.5 0.015 250)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "oklch(1 0 0)",
                  border: "1px solid oklch(0.92 0.006 250)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="recibidos" stroke="oklch(0.72 0.14 232)" strokeWidth={2} fill="url(#g1)" />
              <Area type="monotone" dataKey="cerrados" stroke="oklch(0.65 0.16 152)" strokeWidth={2} fill="url(#g2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Two-column row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Sellers table */}
        <Card className="col-span-2 p-6">
          <h3 className="font-semibold mb-4">Performance por vendedor</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 font-medium">Vendedor</th>
                  <th className="pb-2 font-medium text-center">Asig.</th>
                  <th className="pb-2 font-medium text-center">Cont.</th>
                  <th className="pb-2 font-medium text-center">Cot.</th>
                  <th className="pb-2 font-medium text-center">Cerr.</th>
                  <th className="pb-2 font-medium">Conversión</th>
                  <th className="pb-2 font-medium text-right">Resp.</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.name} className="border-b border-border/50 last:border-0">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary-soft text-primary flex items-center justify-center text-[11px] font-semibold">
                          {s.name.split(" ").map((p) => p[0]).join("")}
                        </div>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="text-center text-muted-foreground">{s.assigned}</td>
                    <td className="text-center text-muted-foreground">{s.contacted}</td>
                    <td className="text-center text-muted-foreground">{s.quoted}</td>
                    <td className="text-center font-semibold">{s.closed}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={s.conversion * 3.5} className="h-1.5 w-20" />
                        <span className="text-xs font-medium w-10">{s.conversion}%</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <span className={cn("text-xs font-medium", s.avgResp <= 20 ? "text-success" : s.avgResp <= 30 ? "text-warning-foreground" : "text-destructive")}>
                        {s.avgResp} min
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Sources */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Origen de leads</h3>
          <div className="space-y-3">
            {sourceData.map((s) => (
              <div key={s.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">{s.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.value * 2}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground">
            Total: <span className="font-semibold text-foreground">142 leads</span> este mes
          </div>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-warning-foreground" />
          <h3 className="font-semibold">Alertas activas</h3>
          <span className="text-xs text-muted-foreground">{alerts.length} requieren tu atención</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-3 flex items-start gap-3",
                a.type === "destructive" && "border-destructive/20 bg-destructive-soft/40",
                a.type === "warning" && "border-warning/30 bg-warning-soft/40",
                a.type === "info" && "border-primary/20 bg-primary-soft/40",
              )}
            >
              <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0",
                a.type === "destructive" && "text-destructive",
                a.type === "warning" && "text-warning-foreground",
                a.type === "info" && "text-primary",
              )} />
              <div>
                <div className="text-sm font-medium">{a.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function BigKpi({ icon, label, value, delta, positive, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; delta?: string; positive?: boolean; sub: string; accent?: "destructive";
}) {
  return (
    <Card className={cn("p-5", accent === "destructive" && "border-destructive/30 bg-destructive-soft/30")}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className={cn(accent === "destructive" ? "text-destructive" : "text-primary")}>{icon}</span>
      </div>
      <div className={cn("mt-3 text-3xl font-semibold tracking-tight", accent === "destructive" && "text-destructive")}>
        {value}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {delta && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", positive ? "text-success" : "text-destructive")}>
            {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {delta}
          </span>
        )}
        <span className="text-muted-foreground">{sub}</span>
      </div>
    </Card>
  );
}
