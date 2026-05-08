import { Card } from "@/components/ui/card";
import { allLeadsExtra, leads } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const stages = [
  { id: "Nuevo", label: "Nuevos", color: "bg-info" },
  { id: "Contactado", label: "Contactados", color: "bg-primary" },
  { id: "Cotizado", label: "Cotizados", color: "bg-warning" },
  { id: "Test drive", label: "Test Drive", color: "bg-accent-foreground" },
  { id: "Negociación", label: "Negociación", color: "bg-warning" },
  { id: "Cerrado", label: "Cerrados", color: "bg-success" },
];

// build a fuller pool by repeating with synthetic stage assignments
const pool = [
  ...leads,
  { ...leads[0], id: "p1", name: "Esteban Quito", model: "Onix LT", status: "Nuevo" as const, estValue: 22000000, daysInStage: 0 },
  { ...leads[0], id: "p2", name: "Mariana Soto", model: "Tracker LT", status: "Nuevo" as const, estValue: 36000000, daysInStage: 1 },
  { ...leads[0], id: "p3", name: "Gonzalo Vega", model: "Cruze 5", status: "Nuevo" as const, estValue: 38000000, daysInStage: 0 },
  { ...leads[0], id: "p4", name: "Andrea Paz", model: "Spin LT", status: "Contactado" as const, estValue: 32000000, daysInStage: 1 },
  { ...leads[0], id: "p5", name: "Marcos Iglesias", model: "Onix Plus", status: "Contactado" as const, estValue: 28000000, daysInStage: 2 },
  { ...leads[0], id: "p6", name: "Tomás Bauer", model: "S10", status: "Contactado" as const, estValue: 75000000, daysInStage: 3 },
  { ...leads[0], id: "p7", name: "Laura Vidal", model: "Tracker Premier", status: "Contactado" as const, estValue: 41000000, daysInStage: 1 },
];
const lost = [
  { id: "l1", name: "Pedro Acuña", model: "Onix LT", estValue: 23000000, daysInStage: 12 },
  { id: "l2", name: "Belén Ferro", model: "Spin LT", estValue: 31000000, daysInStage: 18 },
  { id: "l3", name: "Iván Correa", model: "Cruze 5", estValue: 38000000, daysInStage: 24 },
];

export function PipelineScreen() {
  const [showLost, setShowLost] = useState(false);
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">Vista Kanban de tu embudo de ventas</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((s) => {
          const items = pool.filter((p) => p.status === s.id);
          const total = items.reduce((acc, i) => acc + i.estValue, 0);
          return (
            <div key={s.id} className="w-72 shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", s.color)} />
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">${(total / 1_000_000).toFixed(1)}M</span>
              </div>
              <div className="space-y-2">
                {items.map((it) => (
                  <Card key={it.id} className="p-3 cursor-grab hover:shadow-elevated transition-shadow">
                    <div className="text-sm font-medium">{it.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{it.model}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-primary">${(it.estValue / 1_000_000).toFixed(1)}M</span>
                      <span className="text-muted-foreground">{it.daysInStage}d en etapa</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        <div className="w-72 shrink-0">
          <button onClick={() => setShowLost(!showLost)} className="w-full flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">Perdidos</span>
              <span className="text-xs text-muted-foreground">{lost.length}</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showLost && "rotate-180")} />
          </button>
          {showLost && (
            <div className="space-y-2">
              {lost.map((it) => (
                <Card key={it.id} className="p-3 opacity-70">
                  <div className="text-sm font-medium">{it.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{it.model}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground">Perdido hace {it.daysInStage}d</div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-4">{allLeadsExtra.length} leads totales en el sistema</div>
    </div>
  );
}
