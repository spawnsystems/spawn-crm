import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { sellerKpis } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Target, Clock, TrendingUp, ArrowUp, ArrowDown, Medal, Flame,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const weekData = [
  { day: "Lun", leads: 4, contactados: 4, cerrados: 0 },
  { day: "Mar", leads: 6, contactados: 5, cerrados: 1 },
  { day: "Mié", leads: 3, contactados: 3, cerrados: 0 },
  { day: "Jue", leads: 7, contactados: 6, cerrados: 2 },
  { day: "Vie", leads: 5, contactados: 5, cerrados: 1 },
  { day: "Sáb", leads: 3, contactados: 2, cerrados: 1 },
];

const funnel = [
  { stage: "Asignados", count: 23, pct: 100 },
  { stage: "Contactados", count: 19, pct: 83 },
  { stage: "Cotizados", count: 12, pct: 52 },
  { stage: "Test Drive", count: 5, pct: 22 },
  { stage: "Negociación", count: 3, pct: 13 },
  { stage: "Cerrados", count: 5, pct: 22 },
];

const goals = [
  { label: "Ventas del mes", current: 5, target: 8, unit: "ventas", color: "bg-primary" },
  { label: "Leads trabajados", current: 19, target: 25, unit: "leads", color: "bg-info" },
  { label: "Cotizaciones enviadas", current: 12, target: 15, unit: "cotiz.", color: "bg-warning" },
];

const ranking = [
  { name: "María Gómez", conversion: 28.1, closed: 9, isMe: false },
  { name: "Vos (Jorge Méndez)", conversion: 18.4, closed: 7, isMe: true },
  { name: "Lucía Torres", conversion: 24.0, closed: 6, isMe: false },
  { name: "Juan Pérez", conversion: 18.4, closed: 7, isMe: false },
  { name: "Carlos Ruiz", conversion: 10.7, closed: 3, isMe: false },
];
const sortedRanking = [...ranking].sort((a, b) => b.closed - a.closed || b.conversion - a.conversion);

export function PerformanceScreen() {
  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">Tus métricas individuales · Mayo 2026</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          Actualizado hace 2 min
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Ventas del mes"
          value={sellerKpis.salesMonth.toString()}
          delta="+2"
          positive
          sub="vs mes anterior"
        />
        <KpiCard
          icon={<Target className="h-4 w-4" />}
          label="Tasa de cierre"
          value={`${sellerKpis.closeRate}%`}
          delta="+3.2%"
          positive
          sub="vs mes anterior"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Tiempo de respuesta"
          value={`${sellerKpis.avgResponseMin} min`}
          delta="-6 min"
          positive
          sub="más rápido vs mes anterior"
        />
        <KpiCard
          icon={<Flame className="h-4 w-4" />}
          label="Leads activos"
          value={sellerKpis.totalActive.toString()}
          sub={`${sellerKpis.uncontacted} sin contactar`}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Weekly chart */}
        <Card className="col-span-2 p-6">
          <div className="mb-4">
            <h3 className="font-semibold">Actividad semanal</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Leads recibidos, contactados y cerrados por día</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.92 0.006 250)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.5 0.015 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.5 0.015 250)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.92 0.006 250)", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="leads" name="Recibidos" fill="oklch(0.72 0.14 232)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="contactados" name="Contactados" fill="oklch(0.65 0.16 152)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="cerrados" name="Cerrados" fill="oklch(0.72 0.18 140)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Goals */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Objetivos del mes</h3>
          <div className="space-y-5">
            {goals.map((g) => {
              const pct = Math.round((g.current / g.target) * 100);
              return (
                <div key={g.label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium">{g.label}</span>
                    <span className="text-muted-foreground text-xs">{g.current} / {g.target} {g.unit}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="mt-1 text-[11px] text-muted-foreground text-right">{pct}%</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Funnel */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Mi embudo</h3>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.stage}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{f.stage}</span>
                  <span className="text-muted-foreground">{f.count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", f.stage === "Cerrados" ? "bg-success" : "bg-primary")}
                    style={{ width: `${f.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Ranking */}
        <Card className="col-span-2 p-6">
          <h3 className="font-semibold mb-4">Ranking del equipo</h3>
          <div className="space-y-2">
            {sortedRanking.map((s, i) => (
              <div
                key={s.name}
                className={cn(
                  "flex items-center gap-4 rounded-lg px-3 py-2.5",
                  s.isMe ? "bg-primary/8 border border-primary/20" : "hover:bg-muted/50",
                )}
              >
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  i === 0 ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground",
                )}>
                  {i === 0 ? <Medal className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-medium truncate", s.isMe && "text-primary")}>
                    {s.name}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold">{s.closed} ventas</div>
                  <div className="text-[11px] text-muted-foreground">{s.conversion}% conversión</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, delta, positive, sub }: {
  icon: React.ReactNode; label: string; value: string; delta?: string; positive?: boolean; sub: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
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
