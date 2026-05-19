import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Info, LifeBuoy, UserPlus, XCircle } from "lucide-react";

type RescueCategory = "all" | "cotizado" | "nopresento" | "negociacion";

interface RescueLead {
  id: string;
  name: string;
  model: string;
  daysAbandoned: number;
  abandonStatus: string;
  assignedTo: string;
  reason: string;
  category: "cotizado" | "nopresento" | "negociacion";
  estValue: number;
}

const rescueLeads: RescueLead[] = [
  // Cotizados sin respuesta (5)
  { id: "r1", name: "Fernanda Quiroga", model: "Tracker Premier", daysAbandoned: 18, abandonStatus: "Cotizado", assignedTo: "Juan Pérez", reason: "Recibió cotización por email pero nunca respondió. Abrió el PDF 2 veces.", category: "cotizado", estValue: 42000000 },
  { id: "r2", name: "Roberto Cáceres", model: "S10 High Country", daysAbandoned: 22, abandonStatus: "Cotizado", assignedTo: "María Gómez", reason: "Cotización enviada con opciones de financiación. Dejó de responder WhatsApp.", category: "cotizado", estValue: 78000000 },
  { id: "r3", name: "Valentín Ríos", model: "Onix Plus Premier", daysAbandoned: 20, abandonStatus: "Cotizado", assignedTo: "Pablo Silva", reason: "Pidió descuento adicional, se le ofreció, no volvió a contestar.", category: "cotizado", estValue: 31000000 },
  { id: "r4", name: "Carla Méndez", model: "Cruze 5 Premier", daysAbandoned: 17, abandonStatus: "Cotizado", assignedTo: "Carlos Ruiz", reason: "Cotización enviada. Sin seguimiento posterior por parte del vendedor.", category: "cotizado", estValue: 38000000 },
  { id: "r5", name: "Ignacio Peralta", model: "Tracker LT", daysAbandoned: 25, abandonStatus: "Cotizado", assignedTo: "Lucía Torres", reason: "Respondió una vez con dudas sobre el financiamiento, luego silencio total.", category: "cotizado", estValue: 36500000 },
  // No se presentaron (3)
  { id: "r6", name: "Gastón Herrera", model: "Cruze 5 Premier", daysAbandoned: 16, abandonStatus: "Test drive", assignedTo: "Carlos Ruiz", reason: "Tenía test drive confirmado para el sáb 03/05. No se presentó ni avisó.", category: "nopresento", estValue: 38000000 },
  { id: "r7", name: "Analía Bravo", model: "Onix Plus 1.2 Turbo", daysAbandoned: 19, abandonStatus: "Test drive", assignedTo: "Pablo Silva", reason: "Coordinó test drive por WhatsApp, no apareció. No responde mensajes.", category: "nopresento", estValue: 28500000 },
  { id: "r8", name: "Mauricio Figueroa", model: "Tracker Premier", daysAbandoned: 21, abandonStatus: "Test drive", assignedTo: "Juan Pérez", reason: "Segundo turno perdido consecutivo. Primera cita también la ausentó.", category: "nopresento", estValue: 42000000 },
  // Negociación abandonada (4)
  { id: "r9", name: "Sergio Molina", model: "S10 Midnight", daysAbandoned: 21, abandonStatus: "Negociación", assignedTo: "Juan Pérez", reason: "Estaban acordando el precio del usado en parte de pago. Desapareció mid-negociación.", category: "negociacion", estValue: 82000000 },
  { id: "r10", name: "Daniela Suárez", model: "Tracker Premier", daysAbandoned: 15, abandonStatus: "Negociación", assignedTo: "Lucía Torres", reason: "Pedía bono adicional por financiación bancaria. Negociación frenada sin resolución.", category: "negociacion", estValue: 42000000 },
  { id: "r11", name: "Horacio Blanco", model: "S10 High Country", daysAbandoned: 28, abandonStatus: "Negociación", assignedTo: "María Gómez", reason: "Negoció compra de flota (3 unidades). Sin respuesta desde reunión presencial.", category: "negociacion", estValue: 78000000 },
  { id: "r12", name: "Marcela Vera", model: "Spin LTZ 7as", daysAbandoned: 17, abandonStatus: "Negociación", assignedTo: "Carlos Ruiz", reason: "Estaba muy cerca del cierre, pidió tiempo para consultar con el banco. No volvió.", category: "negociacion", estValue: 35000000 },
];

const filters: { id: RescueCategory; label: string }[] = [
  { id: "all", label: "Todos (12)" },
  { id: "cotizado", label: "Cotizados sin respuesta (5)" },
  { id: "nopresento", label: "No se presentaron (3)" },
  { id: "negociacion", label: "Negociación abandonada (4)" },
];

export function RescueScreen() {
  const [activeFilter, setActiveFilter] = useState<RescueCategory>("all");

  const filtered = activeFilter === "all"
    ? rescueLeads
    : rescueLeads.filter((l) => l.category === activeFilter);

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <LifeBuoy className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Rescate de leads</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Leads abandonados hace +15 días — Campaña de reactivación
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-5 border-b border-border">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              activeFilter === f.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div className="space-y-3">
        {filtered.map((lead) => (
          <RescueCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

function SummaryBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-8 first:pl-0 last:pr-0 flex flex-col gap-1">
      <div className="text-[32px] font-bold leading-none tracking-tight">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function RescueCard({ lead }: { lead: RescueLead }) {
  return (
    <div className="relative rounded-xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow pl-[4px]">
      <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#9CA3AF]" />
      <div className="p-5">
        {/* Row 1 */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base">{lead.name}</span>
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {lead.model}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0 mt-0.5">Hace {lead.daysAbandoned} días</span>
        </div>

        {/* Row 2 */}
        <div className="text-xs text-muted-foreground mb-2.5">
          Estado al abandono: <span className="font-medium text-foreground/70">{lead.abandonStatus}</span>
          <span className="mx-2">·</span>
          Vendedor original: <span className="font-medium text-foreground/70">{lead.assignedTo}</span>
          <span className="mx-2">·</span>
          Valor estimado: <span className="font-medium text-foreground/70">${(lead.estValue / 1_000_000).toFixed(1)}M</span>
        </div>

        {/* Row 3 */}
        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 mb-4">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">{lead.reason}</span>
        </div>

        {/* Row 4 */}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {}}>
            <UserPlus className="h-3.5 w-3.5" />
            Reasignar
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => {}}>
            <XCircle className="h-3.5 w-3.5" />
            Marcar como perdido
          </Button>
        </div>
      </div>
    </div>
  );
}
