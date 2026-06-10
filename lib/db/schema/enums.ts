import { pgEnum } from 'drizzle-orm/pg-core'

export const appRoleEnum = pgEnum('app_role', [
  'platform_admin',
  'dueno',
  'gerente',
  'supervisor',
  'vendedor',
])

export const leadStatusEnum = pgEnum('lead_status', [
  // Inicial — lead recién creado, sin contacto aún
  'NUEVO',
  // Activos / pipeline (en orden)
  'GESTION',
  'HORARIO ASIGNADO',
  'ENTREVISTA PACTADA',
  'CIERRE',
  'VENTA',
  // Baja / terminal (solo vía botón "Dar de baja" con motivo)
  'NO CONTESTA',
  'NO INTERESADO',
  'INCONTACTABLE',
  'YA COMPRO',
  'DATO ERRONEO',
  'DERIVAR',
])

export const leadSourceEnum = pgEnum('lead_source', [
  'Meta Ads',
  'Mercado Libre',
  'Sitio web',
  'Referido',
  'Visita al local',
  'Contacto directo',
  'Dato viejo',
  'Otro',
])

export const teamRoleEnum = pgEnum('team_role', [
  'gerente',
  'supervisor',
  'vendedor',
])

export const rescueCategoryEnum = pgEnum('rescue_category', [
  'cotizado_sin_respuesta',
  'no_se_presento',
  'negociacion_abandonada',
])

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
])

export const moduleKeyEnum = pgEnum('module_key', [
  'pipeline',
  'rescate',
  'test_drive',
  'cotizaciones',
  'inventario',
  'reportes',
  // v2 — secciones reales seleccionables como módulo (migración 026)
  'citas',
  'ventas',
  'historial',
  'auditoria',
])

export const appointmentTipoEnum = pgEnum('appointment_tipo', [
  'videollamada',
  'visita_showroom',
  'cierre',
])

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'programada',
  'realizada',
  'no_se_presento',
  'reagendada',
  'cancelada',
])

export const transferStatusEnum = pgEnum('transfer_status', [
  'pendiente',
  'aceptada',
  'rechazada',
  'cancelada',
])
