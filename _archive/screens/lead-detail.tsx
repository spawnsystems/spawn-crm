import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import type { Lead, LeadStatus } from "@/lib/mock-data";
import {
  Phone, Mail, Car, CheckCircle2, Circle, Calendar, FileText, MessageCircle, Send, ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const STATUSES: LeadStatus[] = ["Nuevo", "Contactado", "Cotizado", "Test drive", "Negociación", "Cerrado", "Perdido"];

const SPECS: Record<string, { modelo: string; motor: string; transmision: string; consumo: string; precio: string; stock: string }> = {
  "Onix Plus 1.2 Turbo": { modelo: "Chevrolet Onix Plus 1.2 Turbo", motor: "1.2L Turbo – 132 CV", transmision: "Automática CVT", consumo: "5.8 L/100km", precio: "$28.500.000", stock: "3 unidades" },
  "Tracker Premier": { modelo: "Chevrolet Tracker Premier", motor: "1.2L Turbo – 132 CV", transmision: "Automática CVT", consumo: "6.2 L/100km", precio: "$42.000.000", stock: "2 unidades" },
  "Tracker LT": { modelo: "Chevrolet Tracker LT", motor: "1.2L Turbo – 132 CV", transmision: "Automática CVT", consumo: "6.2 L/100km", precio: "$36.500.000", stock: "4 unidades" },
  "S10 High Country": { modelo: "Chevrolet S10 High Country 2.8 TD", motor: "2.8L Turbo Diesel – 200 CV", transmision: "Automática 6AT", consumo: "9.1 L/100km", precio: "$78.000.000", stock: "1 unidad" },
  "S10 Midnight": { modelo: "Chevrolet S10 Midnight 2.8 TD", motor: "2.8L Turbo Diesel – 200 CV", transmision: "Automática 6AT", consumo: "9.1 L/100km", precio: "$82.000.000", stock: "1 unidad" },
  "Onix LT": { modelo: "Chevrolet Onix LT 1.0", motor: "1.0L Aspirado – 76 CV", transmision: "Manual 5V", consumo: "5.4 L/100km", precio: "$24.000.000", stock: "6 unidades" },
  "Onix Plus Premier": { modelo: "Chevrolet Onix Plus Premier", motor: "1.2L Turbo – 132 CV", transmision: "Automática CVT", consumo: "5.8 L/100km", precio: "$31.000.000", stock: "2 unidades" },
  "Cruze 5 Premier": { modelo: "Chevrolet Cruze 5P Premier", motor: "1.4L Turbo – 153 CV", transmision: "Automática 6AT", consumo: "7.0 L/100km", precio: "$38.000.000", stock: "2 unidades" },
  "Spin LTZ 7as": { modelo: "Chevrolet Spin LTZ 7 asientos", motor: "1.8L Aspirado – 103 CV", transmision: "Manual 5V", consumo: "7.8 L/100km", precio: "$35.000.000", stock: "3 unidades" },
  "Spin Activ": { modelo: "Chevrolet Spin Activ 1.8", motor: "1.8L Aspirado – 103 CV", transmision: "Automática 6AT", consumo: "8.0 L/100km", precio: "$33.500.000", stock: "2 unidades" },
};

type Task = { done: boolean; text: string; due: string };
type Note = { author: string; date: string; text: string };
type TimelineEvent = { date: string; title: string; desc: string };

function getSpecs(model: string) {
  return SPECS[model] ?? { modelo: `Chevrolet ${model}`, motor: "–", transmision: "–", consumo: "–", precio: "–", stock: "–" };
}

function getInitialTasks(lead: Lead): Task[] {
  const map: Partial<Record<LeadStatus, Task[]>> = {
    Nuevo: [
      { done: false, text: "Primer contacto por WhatsApp — presentarse y consultar disponibilidad", due: "Hoy" },
      { done: false, text: "Enviar ficha técnica y precio de lista", due: "Hoy" },
    ],
    Contactado: [
      { done: true, text: "Primer contacto realizado", due: "Hecho" },
      { done: false, text: "Enviar cotización formal con opciones de financiación", due: "Hoy 18:00" },
      { done: false, text: "Coordinar visita o test drive", due: "Esta semana" },
    ],
    Cotizado: [
      { done: true, text: "Cotización enviada", due: "Hecho" },
      { done: false, text: "Hacer seguimiento — confirmar recepción de cotización", due: "Hoy" },
      { done: false, text: "Reenviar cotización con descuento por financiación", due: "Mañana" },
    ],
    "Test drive": [
      { done: true, text: "Cotización aceptada", due: "Hecho" },
      { done: true, text: "Test drive coordinado", due: "Hecho" },
      { done: false, text: lead.nextAction, due: "Esta semana" },
    ],
    Negociación: [
      { done: true, text: "Test drive realizado", due: "Hecho" },
      { done: true, text: "Condiciones iniciales acordadas", due: "Hecho" },
      { done: false, text: lead.nextAction, due: "Hoy" },
    ],
    Cerrado: [
      { done: true, text: "Venta cerrada ✓", due: "Hecho" },
      { done: false, text: lead.nextAction, due: "Próximamente" },
    ],
    Perdido: [
      { done: true, text: "Lead marcado como perdido", due: "Hecho" },
      { done: false, text: "Programar reactivación en 30 días", due: "Próximo mes" },
    ],
  };
  return map[lead.status] ?? [];
}

function getInitialNotes(lead: Lead): Note[] {
  const pool: Record<string, Note[]> = {
    "1": [
      { author: "Vos", date: "14/05", text: "Cliente con auto usado para entregar (Corsa 2012). Hay que tasarlo." },
      { author: "Vos", date: "15/05", text: "Decide junto a la esposa. Llamar después de las 19hs." },
    ],
    "2": [
      { author: "Vos", date: "13/05", text: "Muy interesada en la versión Premier con cuero. Presupuesto ajustado." },
      { author: "Vos", date: "14/05", text: "Lleva +28h sin respuesta — mandar WhatsApp de reactivación." },
    ],
    "3": [
      { author: "Vos", date: "12/05", text: "Flota empresarial — necesita 4x4 para trabajo en campo." },
      { author: "Vos", date: "14/05", text: "Habló de facturar a empresa. Consultar con administración." },
      { author: "Vos", date: "16/05", text: "Confirmó fecha de entrega para fin de mes." },
    ],
    "5": [{ author: "Vos", date: "14/05", text: "Quiere probar el Cruze antes de decidir vs Toyota Corolla. Competencia directa." }],
    "9": [
      { author: "Vos", date: "15/05", text: "Le interesa la S10 para remolcar una lancha. Consultar capacidad de arrastre." },
      { author: "Vos", date: "16/05", text: "Cotización enviada con accesorios: enganche + cobertor de caja." },
    ],
  };
  return pool[lead.id] ?? [{ author: "Vos", date: "14/05", text: `Lead de ${lead.source}. Consultó por ${lead.model}.` }];
}

function getTimeline(lead: Lead): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { date: "14/05 10:23", title: `Lead recibido — ${lead.source}`, desc: `Consulta por ${lead.model}` },
    { date: "14/05 10:31", title: "Mensaje enviado por WhatsApp", desc: "Saludo + presentación del modelo" },
  ];
  if (["Contactado", "Cotizado", "Test drive", "Negociación", "Cerrado"].includes(lead.status)) {
    events.push({ date: "14/05 11:18", title: "Llamada saliente — 4 min", desc: "Confirmó interés en el modelo" });
  }
  if (["Cotizado", "Test drive", "Negociación", "Cerrado"].includes(lead.status)) {
    events.push({ date: "14/05 16:45", title: "Cotización enviada", desc: `${lead.model} — contado y cuotas` });
    events.push({ date: "15/05 09:15", title: "Cotización vista", desc: "Cliente abrió el PDF" });
  }
  if (["Test drive", "Negociación", "Cerrado"].includes(lead.status)) {
    events.push({ date: "15/05 14:30", title: "Test drive coordinado", desc: "Sábado 18/05 — 11:00 hs" });
  }
  if (["Negociación", "Cerrado"].includes(lead.status)) {
    events.push({ date: "16/05 11:00", title: "Test drive realizado", desc: "Cliente muy conforme con el vehículo" });
    events.push({ date: "16/05 14:00", title: "Negociación iniciada", desc: "Cliente solicita descuento por financiación" });
  }
  if (lead.status === "Cerrado") {
    events.push({ date: "17/05 10:00", title: "Venta cerrada ✓", desc: `${lead.model} — entrega coordinada` });
  }
  return events.reverse();
}

export function LeadDetail({
  lead,
  onClose,
  onStatusChange,
}: {
  lead: Lead | null;
  onClose: () => void;
  onStatusChange?: (id: string, status: LeadStatus) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [currentStatus, setCurrentStatus] = useState<LeadStatus>("Nuevo");

  useEffect(() => {
    if (lead) {
      setTasks(getInitialTasks(lead));
      setNotes(getInitialNotes(lead));
      setCurrentStatus(lead.status);
      setNewNote("");
    }
  }, [lead?.id]);

  if (!lead) return null;

  const specs = getSpecs(lead.model);
  const timeline = getTimeline(lead);

  const toggleTask = (i: number) =>
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, done: !t.done } : t)));

  const addNote = () => {
    const text = newNote.trim();
    if (!text) return;
    const d = new Date();
    const date = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    setNotes((prev) => [{ author: "Vos", date, text }, ...prev]);
    setNewNote("");
  };

  const handleStatusChange = (s: LeadStatus) => {
    setCurrentStatus(s);
    onStatusChange?.(lead.id, s);
  };

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
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Car className="h-4 w-4 text-primary" />
                <span className="font-medium">{lead.model}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 rounded-md hover:bg-accent px-1 py-0.5 transition-colors">
                      <StatusBadge status={currentStatus} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {STATUSES.map((s) => (
                      <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)} className="gap-2">
                        <StatusBadge status={s} />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-success" />WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Phone className="h-3.5 w-3.5" />Llamar
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-3 gap-6 p-6">
          <div className="col-span-2 space-y-6">
            <Section icon={<Calendar className="h-4 w-4" />} title="Próximas acciones">
              <div className="space-y-2">
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <button onClick={() => toggleTask(i)} className="shrink-0">
                      {t.done
                        ? <CheckCircle2 className="h-4 w-4 text-success" />
                        : <Circle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />}
                    </button>
                    <div className="flex-1">
                      <div className={`text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.text}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{t.due}</div>
                    </div>
                    {!t.done && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleTask(i)}>
                        Marcar como hecho
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <Section icon={<Car className="h-4 w-4" />} title="Vehículo de interés">
              <div className="rounded-lg border border-border p-4 grid grid-cols-2 gap-3 text-sm">
                <Spec label="Modelo" value={specs.modelo} />
                <Spec label="Motor" value={specs.motor} />
                <Spec label="Transmisión" value={specs.transmision} />
                <Spec label="Consumo" value={specs.consumo} />
                <Spec label="Precio sugerido" value={specs.precio} />
                <Spec label="Stock" value={specs.stock} />
              </div>
            </Section>

            <Section icon={<FileText className="h-4 w-4" />} title="Notas internas">
              <div className="space-y-2 mb-3">
                {notes.map((n, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">{n.author} · {n.date}</div>
                    <div className="text-sm">{n.text}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Agregar nota... (Ctrl+Enter para guardar)"
                  className="text-sm min-h-[60px] resize-none"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) addNote(); }}
                />
                <Button
                  size="sm"
                  className="shrink-0 self-end gap-1.5"
                  onClick={addNote}
                  disabled={!newNote.trim()}
                >
                  <Send className="h-3.5 w-3.5" />Guardar
                </Button>
              </div>
            </Section>
          </div>

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

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
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
