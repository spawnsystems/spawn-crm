import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { allLeadsExtra, sellers, type Lead, type LeadStatus } from "@/lib/mock-data";
import { LeadDetail } from "./lead-detail";
import { Search, Filter, Plus, UserCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const MODELS = [
  "Onix LT", "Onix Plus 1.2 Turbo", "Onix Plus Premier",
  "Tracker LT", "Tracker Premier",
  "Cruze 5 Premier",
  "Spin LTZ 7as", "Spin Activ",
  "S10 High Country", "S10 Midnight",
];
const SOURCES = ["Meta Ads", "Mercado Libre", "Web", "Referido", "Walk-in"];
const emptyForm = { name: "", phone: "", email: "", model: "", source: "", assignedTo: "" };

export function AllLeadsScreen() {
  const [leadList, setLeadList] = useState<Lead[]>(allLeadsExtra);
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
      nextAction: form.assignedTo ? "Primer contacto WhatsApp" : "Asignar vendedor",
      estValue: 0,
      daysInStage: 0,
      assignedTo: form.assignedTo || "Sin asignar",
    };
    setLeadList((prev) => [newLead, ...prev]);
    setShowNewLead(false);
    setForm(emptyForm);
  };

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Todos los Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{leadList.length} leads en el sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"><Search className="h-3.5 w-3.5" />Buscar</Button>
          <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" />Filtros</Button>
          <Button size="sm" className="gap-1.5" onClick={() => setShowNewLead(true)}>
            <Plus className="h-3.5 w-3.5" />Nuevo Lead
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Modelo</th>
              <th className="px-4 py-3 font-medium">Origen</th>
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Último contacto</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {leadList.map((l) => (
              <tr
                key={l.id}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer"
                onClick={() => setOpenLead(l)}
              >
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.model}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.source}</td>
                <td className="px-4 py-3">
                  {l.assignedTo && l.assignedTo !== "Sin asignar" ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <div className="h-5 w-5 rounded-full bg-primary-soft text-primary flex items-center justify-center text-[9px] font-semibold shrink-0">
                        {l.assignedTo.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-xs">{l.assignedTo}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">Sin asignar</span>
                  )}
                </td>
                <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                <td className={`px-4 py-3 text-xs ${l.lastContactCritical ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {l.lastContact}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" className="h-7">Ver</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

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
              <div className="col-span-2 space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  Asignar vendedor
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Select value={form.assignedTo} onValueChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Dejar sin asignar por ahora..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sellers.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary-soft text-primary flex items-center justify-center text-[9px] font-semibold">
                            {s.name.split(" ").map((p) => p[0]).join("")}
                          </div>
                          <span>{s.name}</span>
                          <span className="text-muted-foreground text-xs">· {s.assigned} leads</span>
                        </div>
                      </SelectItem>
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
