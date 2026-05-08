import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { leads, sellerKpis, type Lead, type LeadStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ArrowDown, MessageCircle, Phone, ChevronRight, Clock, Target, TrendingDown, Plus,
} from "lucide-react";
import { LeadDetail } from "./lead-detail";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const filters = ["Todos", "Sin contactar", "En seguimiento", "En riesgo", "Cerrados"] as const;

const MODELS = [
  "Onix LT", "Onix Plus 1.2 Turbo", "Onix Plus Premier",
  "Tracker LT", "Tracker Premier",
  "Cruze 5 Premier",
  "Spin LTZ 7as", "Spin Activ",
  "S10 High Country", "S10 Midnight",
];
const SOURCES = ["Meta Ads", "Mercado Libre", "Web", "Referido", "Walk-in"];

const emptyForm = { name: "", phone: "", email: "", model: "", source: "" };

export function MyLeadsScreen() {
  const [filter, setFilter] = useState<typeof filters[number]>("Todos");
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [leadList, setLeadList] = useState<Lead[]>(leads);
  const [showNewLead, setShowNewLead] = useState(false);
  const [form, setForm] = useState(emptyForm);

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

  const handleNewLead = () => {
    if (!form.name || !form.phone || !form.model || !form.source) return;
    const newLead: Lead = {
      id: `new-${Date.now()}`,
      name: form.name,
      phone: form.phone,
      email: form.email || `${form.name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
      model: form.model,
      source: form.source,
      lastContact: "Sin contactar",
      lastContactCritical: true,
      status: "Nuevo",
      nextAction: "Primer contacto WhatsApp",
      estValue: 0,
      daysInStage: 0,
      assignedTo: "Vos",
    };
    setLeadList((prev) => [newLead, ...prev]);
    setShowNewLead(false);
    setForm(emptyForm);
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{leadList.filter(l => !["Cerrado","Perdido"].includes(l.status)).length} leads activos</p>
        </div>
        <Button className="gap-2" onClick={() => setShowNewLead(true)}>
          <Plus className="h-4 w-4" /> Nuevo Lead
        </Button>
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

      {/* Nuevo Lead modal */}
      <Dialog open={showNewLead} onOpenChange={setShowNewLead}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="nl-name">Nombre completo *</Label>
                <Input
                  id="nl-name"
                  placeholder="Ej: Martín Rodríguez"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-phone">Teléfono *</Label>
                <Input
                  id="nl-phone"
                  placeholder="+54 9 11 ..."
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-email">Email</Label>
                <Input
                  id="nl-email"
                  placeholder="opcional"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo de interés *</Label>
                <Select value={form.model} onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Origen *</Label>
                <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="¿De dónde viene?" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewLead(false); setForm(emptyForm); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleNewLead}
              disabled={!form.name || !form.phone || !form.model || !form.source}
            >
              Crear lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
