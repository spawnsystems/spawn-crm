import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { sellers } from "@/lib/mock-data";
import { ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function TeamScreen() {
  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
        <p className="text-sm text-muted-foreground mt-1">{sellers.length} vendedores activos</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {sellers.map((s) => (
          <Card key={s.name} className="p-5 flex items-center gap-6 hover:shadow-elevated transition-shadow">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center font-semibold">
              {s.name.split(" ").map((p) => p[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Última actividad {s.lastActive}
              </div>
            </div>
            <Stat label="Asignados" value={s.assigned} />
            <Stat label="Cerrados" value={s.closed} highlight />
            <Stat label="Conversión" value={`${s.conversion}%`} />
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Tiempo respuesta</div>
              <div className={cn("font-semibold inline-flex items-center gap-1 mt-0.5",
                s.avgResp <= 20 ? "text-success" : s.avgResp <= 30 ? "text-warning-foreground" : "text-destructive")}>
                <Clock className="h-3.5 w-3.5" /> {s.avgResp} min
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1">
              Ver detalle <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="text-center min-w-[80px]">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("font-semibold mt-0.5", highlight && "text-primary")}>{value}</div>
    </div>
  );
}
