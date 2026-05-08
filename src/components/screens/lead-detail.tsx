import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { timeline, notes, vehicleSpecs } from "@/lib/mock-data";
import type { Lead } from "@/lib/mock-data";
import { Phone, Mail, Car, CheckCircle2, Circle, Calendar, FileText, MessageCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function LeadDetail({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  if (!lead) return null;
  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-0">
        <SheetHeader className="p-6 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{lead.name}</SheetTitle>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>
                <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{lead.email}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                <span className="font-medium">{lead.model}</span>
                <StatusBadge status={lead.status} className="ml-2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-success" />WhatsApp</Button>
              <Button size="sm" variant="outline" className="gap-1.5"><Phone className="h-3.5 w-3.5" />Llamar</Button>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-6 p-6">
          <div className="col-span-2 space-y-6">
            <Section icon={<Calendar className="h-4 w-4" />} title="Próximas acciones">
              <div className="space-y-2">
                {[
                  { done: false, text: "Reenviar cotización con descuento por financiación", due: "Hoy 18:00" },
                  { done: false, text: "Coordinar test drive sábado 18/05", due: "Mañana" },
                  { done: true, text: "Tasar Corsa 2012 entregado a cuenta", due: "Hecho" },
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    {t.done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <div className="flex-1">
                      <div className={`text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.text}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{t.due}</div>
                    </div>
                    {!t.done && <Button size="sm" variant="ghost" className="h-7 text-xs">Marcar como hecho</Button>}
                  </div>
                ))}
              </div>
            </Section>

            <Section icon={<Car className="h-4 w-4" />} title="Vehículo de interés">
              <div className="rounded-lg border border-border p-4 grid grid-cols-2 gap-3 text-sm">
                <Spec label="Modelo" value={vehicleSpecs.modelo} />
                <Spec label="Motor" value={vehicleSpecs.motor} />
                <Spec label="Transmisión" value={vehicleSpecs.transmision} />
                <Spec label="Consumo" value={vehicleSpecs.consumo} />
                <Spec label="Precio sugerido" value={vehicleSpecs.precio} />
                <Spec label="Stock" value={vehicleSpecs.stock} />
              </div>
            </Section>

            <Section icon={<FileText className="h-4 w-4" />} title="Notas internas">
              <div className="space-y-2">
                {notes.map((n, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">{n.author} · {n.date}</div>
                    <div className="text-sm">{n.text}</div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Timeline */}
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">Historial</div>
            <div className="relative pl-5">
              <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
              {timeline.map((e, i) => (
                <div key={i} className="relative pb-4">
                  <div className="absolute -left-[14px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="text-[11px] text-muted-foreground">{e.date}</div>
                  <div className="text-sm font-medium mt-0.5">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{e.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon, title, children }: any) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
