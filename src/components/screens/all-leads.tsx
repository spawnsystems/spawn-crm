import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { allLeadsExtra, type Lead } from "@/lib/mock-data";
import { LeadDetail } from "./lead-detail";
import { Search, Filter } from "lucide-react";

export function AllLeadsScreen() {
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Todos los Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{allLeadsExtra.length} leads en el sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"><Search className="h-3.5 w-3.5" />Buscar</Button>
          <Button variant="outline" size="sm" className="gap-1.5"><Filter className="h-3.5 w-3.5" />Filtros</Button>
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
            {allLeadsExtra.map((l) => (
              <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setOpenLead(l)}>
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.model}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.source}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.assignedTo}</td>
                <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                <td className={`px-4 py-3 text-xs ${l.lastContactCritical ? "text-destructive font-medium" : "text-muted-foreground"}`}>{l.lastContact}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" className="h-7">Ver</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <LeadDetail lead={openLead} onClose={() => setOpenLead(null)} />
    </div>
  );
}
