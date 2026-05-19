export type LeadStatus = "Nuevo" | "Contactado" | "Cotizado" | "Test drive" | "Negociación" | "Cerrado" | "Perdido";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  model: string;
  source: string;
  lastContact: string;
  lastContactCritical?: boolean;
  status: LeadStatus;
  nextAction: string;
  estValue: number;
  daysInStage: number;
  atRisk?: boolean;
  assignedTo?: string;
}

export const leads: Lead[] = [
  { id: "1", name: "Martín Rodríguez", phone: "+54 9 11 4567-8901", email: "martin.rodriguez@gmail.com", model: "Onix Plus 1.2 Turbo", source: "Meta Ads - Campaña Onix", lastContact: "Sin respuesta hace 3h", status: "Contactado", nextAction: "Llamar en 2h", estValue: 28500000, daysInStage: 2, assignedTo: "Vos" },
  { id: "2", name: "Lucía Fernández", phone: "+54 9 11 5123-9087", email: "lucia.fer@hotmail.com", model: "Tracker Premier", source: "Meta Ads - Tracker", lastContact: "Sin respuesta hace 28h", lastContactCritical: true, status: "Cotizado", nextAction: "Reenviar cotización + descuento", estValue: 42000000, daysInStage: 4, atRisk: true, assignedTo: "Vos" },
  { id: "3", name: "Diego Sosa", phone: "+54 9 11 6234-1190", email: "dsosa@gmail.com", model: "S10 High Country", source: "Mercado Libre", lastContact: "Hace 12 min", status: "Negociación", nextAction: "Confirmar fecha entrega", estValue: 78000000, daysInStage: 6, assignedTo: "Vos" },
  { id: "4", name: "Camila Pereyra", phone: "+54 9 11 3344-5566", email: "cami.pereyra@gmail.com", model: "Onix LT", source: "Web", lastContact: "Sin contactar", lastContactCritical: true, status: "Nuevo", nextAction: "Primer contacto WhatsApp", estValue: 24000000, daysInStage: 0, assignedTo: "Vos" },
  { id: "5", name: "Federico Álvarez", phone: "+54 9 11 7788-2211", email: "fede.alvarez@gmail.com", model: "Cruze 5 Premier", source: "Meta Ads - Cruze", lastContact: "Hace 2 días", status: "Test drive", nextAction: "Coordinar test drive sábado", estValue: 38000000, daysInStage: 3, assignedTo: "Vos" },
  { id: "6", name: "Romina Giménez", phone: "+54 9 11 4422-7766", email: "romi.gimenez@gmail.com", model: "Spin LTZ 7as", source: "Referido", lastContact: "Sin respuesta hace 36h", lastContactCritical: true, status: "Cotizado", nextAction: "Reactivar lead", estValue: 35000000, daysInStage: 5, atRisk: true, assignedTo: "Vos" },
  { id: "7", name: "Nicolás Martínez", phone: "+54 9 11 8899-1122", email: "nico.mtz@outlook.com", model: "Tracker LT", source: "Meta Ads - Tracker", lastContact: "Hace 4h", status: "Contactado", nextAction: "Enviar ficha técnica", estValue: 36500000, daysInStage: 1, assignedTo: "Vos" },
  { id: "8", name: "Valentina Romero", phone: "+54 9 11 5566-3344", email: "vale.romero@gmail.com", model: "Onix Plus Premier", source: "Web", lastContact: "Sin contactar", lastContactCritical: true, status: "Nuevo", nextAction: "Primer contacto", estValue: 31000000, daysInStage: 0, assignedTo: "Vos" },
  { id: "9", name: "Joaquín Ibáñez", phone: "+54 9 11 2233-9988", email: "joaco.ibanez@gmail.com", model: "S10 Midnight", source: "Mercado Libre", lastContact: "Hace 1h", status: "Cotizado", nextAction: "Llamar para feedback", estValue: 82000000, daysInStage: 2, assignedTo: "Vos" },
  { id: "10", name: "Sofía Méndez", phone: "+54 9 11 6677-4455", email: "sofi.mendez@gmail.com", model: "Spin Activ", source: "Walk-in", lastContact: "Hace 6h", status: "Cerrado", nextAction: "Coordinar entrega", estValue: 33500000, daysInStage: 1, assignedTo: "Vos" },
];

export const allLeadsExtra: Lead[] = [
  ...leads,
  { id: "11", name: "Hernán Castro", phone: "+54 9 11 1234-9999", email: "h.castro@gmail.com", model: "Onix LT", source: "Meta Ads", lastContact: "Hace 30 min", status: "Contactado", nextAction: "Cotizar", estValue: 25000000, daysInStage: 1, assignedTo: "Juan Pérez" },
  { id: "12", name: "Agustina López", phone: "+54 9 11 8765-1212", email: "agus.lopez@gmail.com", model: "Tracker Premier", source: "Web", lastContact: "Hace 45 min", status: "Nuevo", nextAction: "Contactar", estValue: 41000000, daysInStage: 0, assignedTo: "Juan Pérez" },
];

export const sellerKpis = {
  uncontacted: 4,
  avgResponseMin: 14,
  closeRate: 18,
  totalActive: 23,
  salesMonth: 5,
  leadsMonth: 28,
};

export const managerKpis = {
  monthLeads: 142,
  monthLeadsDelta: 18,
  conversionRate: 12.4,
  conversionDelta: 2.1,
  avgResponseMin: 22,
  avgResponseDelta: -8,
  atRiskNow: 7,
};

export const trendData = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const recibidos = Math.round(4 + Math.sin(i / 3) * 2 + Math.random() * 3 + i * 0.1);
  const cerrados = Math.max(0, Math.round(recibidos * (0.1 + Math.random() * 0.18)));
  return { day: `${day}`, recibidos, cerrados };
});

export const sellers = [
  { name: "Juan Pérez", assigned: 38, contacted: 35, quoted: 24, closed: 7, conversion: 18.4, avgResp: 18, lastActive: "hace 5 min" },
  { name: "María Gómez", assigned: 32, contacted: 31, quoted: 22, closed: 9, conversion: 28.1, avgResp: 12, lastActive: "hace 2 min" },
  { name: "Carlos Ruiz", assigned: 28, contacted: 22, quoted: 14, closed: 3, conversion: 10.7, avgResp: 41, lastActive: "hace 1h" },
  { name: "Lucía Torres", assigned: 25, contacted: 25, quoted: 18, closed: 6, conversion: 24.0, avgResp: 15, lastActive: "hace 12 min" },
  { name: "Pablo Silva", assigned: 19, contacted: 17, quoted: 9, closed: 2, conversion: 10.5, avgResp: 33, lastActive: "hace 25 min" },
];

export const sourceData = [
  { name: "Meta Ads", value: 45, color: "var(--color-primary)" },
  { name: "Mercado Libre", value: 22, color: "var(--color-success)" },
  { name: "Web", value: 18, color: "var(--color-warning)" },
  { name: "Referidos", value: 10, color: "var(--color-chart-5)" },
  { name: "Walk-in", value: 5, color: "var(--color-muted-foreground)" },
];

export const alerts = [
  { type: "warning", title: "5 leads sin asignar hace +1h", desc: "Bandeja general acumulando" },
  { type: "destructive", title: "Juan Pérez tiene 3 leads en riesgo", desc: "Sin respuesta hace +24h" },
  { type: "info", title: "Pico de leads en última hora (+12)", desc: "Campaña Tracker activa" },
  { type: "warning", title: "2 cotizaciones vencen mañana", desc: "Federico Álvarez, Diego Sosa" },
];

export const timeline = [
  { date: "14/05 10:23", title: "Lead recibido de Meta Ads", desc: "Campaña Onix - formulario" },
  { date: "14/05 10:31", title: "Mensaje enviado por WhatsApp", desc: "Saludo + presentación de modelo" },
  { date: "14/05 11:02", title: "Respuesta del cliente", desc: "Pregunta por financiación" },
  { date: "14/05 11:18", title: "Llamada saliente — 4 min", desc: "Confirmó interés en versión Plus" },
  { date: "14/05 16:45", title: "Cotización enviada por email", desc: "Onix Plus 1.2 Turbo - contado y cuotas" },
  { date: "15/05 09:15", title: "Cotización vista", desc: "Cliente abrió el PDF (3 veces)" },
  { date: "15/05 14:30", title: "Coordinación de test drive", desc: "Sábado 18/05 - 11:00 hs" },
  { date: "16/05 10:02", title: "Recordatorio enviado", desc: "WhatsApp automático test drive" },
];

export const notes = [
  { author: "Vos", date: "14/05", text: "Cliente con auto usado para entregar (Corsa 2012). Tasarlo." },
  { author: "Vos", date: "15/05", text: "Decide junto a la esposa. Mejor llamar después de las 19hs." },
  { author: "Vos", date: "16/05", text: "Muy interesado en versión Premier, mostrar diferencia de equipamiento." },
];

export const vehicleSpecs = {
  modelo: "Chevrolet Onix Plus 1.2 Turbo",
  motor: "1.2L Turbo - 132 CV",
  transmision: "Automática CVT",
  consumo: "5.8 L/100km",
  precio: "$28.500.000",
  stock: "3 unidades",
  colores: ["Blanco Summit", "Negro Carbon", "Plata Switchblade"],
};
