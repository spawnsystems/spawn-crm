-- ════════════════════════════════════════════════════════════════════════════
-- RESET DE DATA OPERATIVA — todos los tenants
-- ════════════════════════════════════════════════════════════════════════════
-- Borra toda la data transaccional/operativa para empezar el testing desde cero.
--
-- CONSERVA (NO se tocan):
--   tenants, usuarios, tenant_members, equipos, tenant_modules,
--   lead_sources_custom, modelos_vehiculo, metas_mensuales, notification_prefs
--
-- BORRA: leads y todo lo que cuelga de ellos, + notifications, audit_logs, email_log.
--
-- Cómo correr: pegar en el SQL editor de Supabase (o `npm run db:studio`) y ejecutar.
-- El orden respeta las FK. (Varias caen por ON DELETE CASCADE al borrar leads, pero
-- el orden explícito es más seguro y deja claro qué se está borrando.)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- registro_ventas antes que cotizaciones (FK usado_tomado_id → cotizaciones)
DELETE FROM registro_ventas;
DELETE FROM cotizaciones;

-- Hijos de leads
DELETE FROM lead_transfers;
DELETE FROM lead_calls;
DELETE FROM lead_tasks;
DELETE FROM lead_notes;
DELETE FROM lead_timeline;
DELETE FROM lead_appointments;

-- Notificaciones in-app (cuelgan de usuarios/tenant, no de leads)
DELETE FROM notifications;

-- Leads
DELETE FROM leads;

-- Auditoría y logs de email
DELETE FROM audit_logs;
DELETE FROM email_log;

COMMIT;

-- ── Verificación (correr aparte para confirmar) ──────────────────────────────
--   SELECT count(*) FROM leads;             -- esperado: 0
--   SELECT count(*) FROM cotizaciones;      -- esperado: 0
--   SELECT count(*) FROM lead_appointments; -- esperado: 0
--   SELECT count(*) FROM usuarios;          -- esperado: SIN CAMBIOS
--   SELECT count(*) FROM equipos;           -- esperado: SIN CAMBIOS
--   SELECT count(*) FROM tenants;           -- esperado: SIN CAMBIOS
