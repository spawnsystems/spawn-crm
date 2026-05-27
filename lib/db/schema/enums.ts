import { pgEnum } from 'drizzle-orm/pg-core'

export const appRoleEnum = pgEnum('app_role', [
  'platform_admin',
  'dueno',
  'gerente',
  'supervisor',
  'vendedor',
])

export const leadStatusEnum = pgEnum('lead_status', [
  'Nuevo',
  'Contactado',
  'Citado',
  'Cerrado',
  'Para rescate',
])

export const leadSourceEnum = pgEnum('lead_source', [
  'Meta Ads',
  'Mercado Libre',
  'Web',
  'Referido',
  'Walk-in',
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
])

export const appointmentTipoEnum = pgEnum('appointment_tipo', [
  'test_drive',
  'visita_showroom',
  'videollamada',
  'entrega',
])

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'programada',
  'realizada',
  'no_se_presento',
  'reagendada',
  'cancelada',
])
