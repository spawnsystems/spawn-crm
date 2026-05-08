import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { leads, sellerKpis, type Lead, type LeadStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ArrowDown, MessageCircle, Phone, ChevronRight, Clock, Target,
} from "lucide-react";
import { LeadDetail } from "./lead-detail";

const filters = ["Todos", "Sin contactar", "En seguimiento", "En riesgo", "Cerrados"] as const;

export function MyLeadsScreen() {
  const [filter, setFilter] = useState<typeof filters[number]>("Todos");
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [leadList, setLeadList] = useState<Lead[]>(leads);

  const filtered = leadList.filter((l) => {
    if (filter === "Todos") return true;
    if (filter === "Sin contactar") return l.status === "Nuevo";
    if (filter === "En seguimiento") return ["Contactado", "Cotizado", "Test drive", "Negociación"].includes(l.status);
    if (filter === "En riesgo") return l.atRisk;
    if (filter === "Cerrados") return l.status === "Cerrado";
    return true;
  });

  const handleStatusChange = (id: string, status: LeadStatus) => {
    setLeadList((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    setOpenLead((prev) => (prev?.id === id ? { ...prev, status } : prev));
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{leadList.filter(l => !["Cerrado","Perdido"].includes(l.status)).length} leads activos</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          label="Sin contactar"
          value={sellerKpis.uncontacted.toString()}
          sub="requieren atención"
          accent="destructive"
        />
        <KpiCard
          icon={<Clock className="h-4 w-4 text-success" />}
          label="Tiempo promedio de respuesta"
          value={`${sellerKpis.avgResponseMin} min`}
          sub={<span className="inline-flex items-center gap-1 text-success"><ArrowDown className="h-3 w-3" />-6 min vs mes anterior</span>}
        />
        <KpiCard
          icon={<Target className="h-4 w-4 text-primary" />}
          label="% de cierre del mes"
          value={`${sellerKpis.closeRate}%`}
          sub={`${sellerKpis.salesMonth} ventas / ${sellerKpis.leadsMonth} leads`}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-5 border-b border-border">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              filter === f ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
            {f === "En riesgo" && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {leadList.filter((l) => l.atRisk).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lead cards */}
      <div className="space-y-3">
        {filtered.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={() => setOpenLead(lead)} />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No hay leads en esta categoría.
          </div>
        )}
      </div>

      <LeadDetail lead={openLead} onClose={() => setOpenLead(null)} onStatusChange={handleStatusChange} />
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub: React.ReactNode; accent?: "destructive";
}) {
  return (
    <Card className={cn("p-5 border-border", accent === "destructive" && "border-destructive/20 bg-destructive-soft/40")}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        {icon}
      </div>
      <div className={cn("mt-3 text-3xl font-semibold tracking-tight", accent === "destructive" && "text-destructive")}>
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  return (
    <Card
      onClick={onOpen}
      className={cn(
        "group relative overflow-hidden p-0 cursor-pointer transition-all hover:shadow-elevated",
        lead.atRisk && "border-l-0",
      )}
    >
      {lead.atRisk && <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />}
      <div className="p-5 pl-6 flex items-center gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold text-base">{lead.name}</h3>
            <StatusBadge status={lead.status} />
            {lead.atRisk && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive bg-destructive-soft px-2 py-0.5 rounded-full border border-destructive/20">
                <AlertTriangle className="h-3 w-3" /> En riesgo
              </span>
            )}
          </div>
          <div className="mt-1.5 text-sm text-muted-foreground">
            <span className="text-foreground/80 font-medium">{lead.model}</span>
            <span className="mx-2">·</span>
            <span>{lead.source}</span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className={cn("inline-flex items-center gap-1", lead.lastContactCritical ? "text-destructive font-medium" : "text-muted-foreground")}>
              <Clock className="h-3 w-3" />
              {lead.lastContact}
            </span>
            <span className="text-muted-foreground">
              Próxima acción: <span className="text-foreground font-medium">{lead.nextAction}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="h-8 gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 text-success" /> WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Llamar
          </Button>
          <Button size="sm" onClick={onOpen} className="h-8 gap-1">
            Ver ficha <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
