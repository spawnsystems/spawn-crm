-- ============================================================
-- 014_tenant_sla_config.sql — Config de SLA por tenant
-- ============================================================
-- Umbral configurable para "Demorado" (primer contacto) e inactividad
-- (pase a rescate). Se lee en la capa de app (lib/leads/sla.ts) — los
-- triggers hardcodeados se eliminan en 015.
-- ============================================================

BEGIN;

ALTER TABLE tenants
  ADD COLUMN sla_config jsonb NOT NULL
  DEFAULT '{"primerContactoHoras": 24, "sinContactoDias": 15}'::jsonb;

COMMIT;
