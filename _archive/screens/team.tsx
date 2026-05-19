import { Card } from "@/components/ui/card";
import { sellers } from "@/lib/mock-data";
import { Clock, Medal, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

const sorted = [...sellers].sort((a, b) => b.closed - a.closed || b.conversion - a.conversion);
const maxClosed = sorted[0]?.closed ?? 1;

const MEDAL_COLORS = [
  "bg-yellow-400 text-yellow-900",
  "bg-slate-300 text-slate-700",
  "bg-orange-400 text-orange-900",
];

export function TeamScreen() {
  return (
    <div className="p-8 max-w-[1000px] mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground mt-1">Ranking por ventas · Mayo 2026</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Trophy className="h-4 w-4 text-warning-foreground" />
          <span>{sorted.length} vendedores activos</span>
        </div>
      </div>

      {/* Podio top 3 */}
      <div className="flex items-end justify-center gap-4 mb-8">
        {/* 2do */}
        {sorted[1] && (
          <PodiumCard seller={sorted[1]} position={2} />
        )}
        {/* 1ro */}
        {sorted[0] && (
          <PodiumCard seller={sorted[0]} position={1} featured />
        )}
        {/* 3ro */}
        {sorted[2] && (
          <PodiumCard seller={sorted[2]} position={3} />
        )}
      </div>

      {/* Resto del ranking */}
      {sorted.length > 3 && (
        <div className="space-y-2">
          {sorted.slice(3).map((s, i) => (
            <Card key={s.name} className="px-5 py-4 flex items-center gap-5">
              <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold shrink-0">
                {i + 4}
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                {s.name.split(" ").map((p) => p[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{s.name}</div>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Activo {s.lastActive}
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm shrink-0">
                <Metric label="Ventas" value={`${s.closed}`} highlight />
                <Metric label="Conversión" value={`${s.conversion}%`} />
                <div className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={cn("font-medium",
                    s.avgResp <= 20 ? "text-success" : s.avgResp <= 30 ? "text-warning-foreground" : "text-destructive"
                  )}>{s.avgResp} min</span>
                </div>
              </div>
              <div className="w-28 shrink-0">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Ventas</span>
                  <span>{s.closed}/{maxClosed}</span>
                </div>
                <Progress value={(s.closed / maxClosed) * 100} className="h-1.5" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PodiumCard({ seller: s, position, featured }: {
  seller: typeof sellers[0];
  position: number;
  featured?: boolean;
}) {
  return (
    <Card className={cn(
      "flex flex-col items-center text-center transition-shadow",
      featured ? "px-8 py-6 shadow-elevated w-56" : "px-6 py-5 w-44",
    )}>
      {/* Medal */}
      <div className={cn(
        "flex items-center justify-center rounded-full font-bold mb-3",
        featured ? "h-10 w-10 text-base" : "h-8 w-8 text-sm",
        MEDAL_COLORS[position - 1] ?? "bg-muted text-muted-foreground",
      )}>
        {position === 1 ? <Medal className={featured ? "h-5 w-5" : "h-4 w-4"} /> : position}
      </div>

      {/* Avatar */}
      <div className={cn(
        "rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-semibold mb-3",
        featured ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm",
      )}>
        {s.name.split(" ").map((p) => p[0]).join("")}
      </div>

      <div className={cn("font-semibold leading-tight", featured ? "text-base" : "text-sm")}>{s.name}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 mb-3">
        Activo {s.lastActive}
      </div>

      {/* Main stat */}
      <div className={cn(
        "font-bold text-primary",
        featured ? "text-4xl" : "text-3xl",
      )}>
        {s.closed}
      </div>
      <div className="text-xs text-muted-foreground mb-3">ventas del mes</div>

      {/* Secondary stats */}
      <div className="w-full border-t border-border pt-3 grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="text-xs font-semibold">{s.conversion}%</div>
          <div className="text-[10px] text-muted-foreground">conversión</div>
        </div>
        <div>
          <div className={cn("text-xs font-semibold",
            s.avgResp <= 20 ? "text-success" : s.avgResp <= 30 ? "text-warning-foreground" : "text-destructive"
          )}>
            {s.avgResp} min
          </div>
          <div className="text-[10px] text-muted-foreground">respuesta</div>
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={cn("font-semibold", highlight && "text-primary")}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
