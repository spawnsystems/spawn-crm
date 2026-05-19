import { Card } from "@/components/ui/card";
import { allLeadsExtra, leads, type Lead, type LeadStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { LeadDetail } from "./lead-detail";

const stages = [
  { id: "Nuevo", label: "Nuevos", color: "bg-info" },
  { id: "Contactado", label: "Contactados", color: "bg-primary" },
  { id: "Cotizado", label: "Cotizados", color: "bg-warning" },
  { id: "Test drive", label: "Test Drive", color: "bg-accent-foreground" },
  { id: "Negociación", label: "Negociación", color: "bg-warning" },
  { id: "Cerrado", label: "Cerrados", color: "bg-success" },
];

const pool: Lead[] = [
  ...leads,
  { ...leads[0], id: "p1", name: "Esteban Quito", model: "Onix LT", status: "Nuevo", estValue: 22000000, daysInStage: 0 },
  { ...leads[0], id: "p2", name: "Mariana Soto", model: "Tracker LT", status: "Nuevo", estValue: 36000000, daysInStage: 1 },
  { ...leads[0], id: "p3", name: "Gonzalo Vega", model: "Cruze 5 Premier", status: "Nuevo", estValue: 38000000, daysInStage: 0 },
  { ...leads[0], id: "p4", name: "Andrea Paz", model: "Spin LTZ 7as", status: "Contactado", estValue: 32000000, daysInStage: 1 },
  { ...leads[0], id: "p5", name: "Marcos Iglesias", model: "Onix Plus 1.2 Turbo", status: "Contactado", estValue: 28000000, daysInStage: 2 },
  { ...leads[0], id: "p6", name: "Tomás Bauer", model: "S10 High Country", status: "Contactado", estValue: 75000000, daysInStage: 3 },
  { ...leads[0], id: "p7", name: "Laura Vidal", model: "Tracker Premier", status: "Contactado", estValue: 41000000, daysInStage: 1 },
];

const lost: Lead[] = [
  { id: "l1", name: "Pedro Acuña", phone: "+54 9 11 1111-0001", email: "pedro.acuna@gmail.com", model: "Onix LT", source: "Meta Ads", lastContact: "Hace 12 días", status: "Perdido", nextAction: "Reactivar en 30 días", estValue: 23000000, daysInStage: 12, assignedTo: "Vos" },
  { id: "l2", name: "Belén Ferro", phone: "+54 9 11 1111-0002", email: "belen.ferro@gmail.com", model: "Spin LTZ 7as", source: "Web", lastContact: "Hace 18 días", status: "Perdido", nextAction: "Reactivar en 30 días", estValue: 31000000, daysInStage: 18, assignedTo: "Vos" },
  { id: "l3", name: "Iván Correa", phone: "+54 9 11 1111-0003", email: "ivan.correa@gmail.com", model: "Cruze 5 Premier", source: "Mercado Libre", lastContact: "Hace 24 días", status: "Perdido", nextAction: "Reactivar en 30 días", estValue: 38000000, daysInStage: 24, assignedTo: "Vos" },
];

export function PipelineScreen() {
  const [showLost, setShowLost] = useState(false);
  const [poolState, setPoolState] = useState<Lead[]>(pool);
  const [lostState] = useState<Lead[]>(lost);
  const [openLead, setOpenLead] = useState<Lead | null>(null);

  const handleStatusChange = (id: string, status: LeadStatus) => {
    setPoolState((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">Vista Kanban de tu embudo de ventas</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((s) => {
          const items = poolState.filter((p) => p.status === s.id);
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
                  <Card
                    key={it.id}
                    className="p-3 cursor-pointer hover:shadow-elevated transition-shadow"
                    onClick={() => setOpenLead(it)}
                  >
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
          <button
            onClick={() => setShowLost(!showLost)}
            className="w-full flex items-center justify-between mb-3 px-1"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="text-sm font-semibold text-muted-foreground">Perdidos</span>
              <span className="text-xs text-muted-foreground">{lostState.length}</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showLost && "rotate-180")} />
          </button>
          {showLost && (
            <div className="space-y-2">
              {lostState.map((it) => (
                <Card
                  key={it.id}
                  className="p-3 opacity-70 cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => setOpenLead(it)}
                >
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

      <LeadDetail
        lead={openLead}
        onClose={() => setOpenLead(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
