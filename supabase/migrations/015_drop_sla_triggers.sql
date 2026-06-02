-- ============================================================
-- 015_drop_sla_triggers.sql — Eliminar triggers de SLA + kind en tareas
-- ============================================================
-- "Demorado" e inactividad pasan a derivarse en la capa de app con el
-- umbral configurable por tenant (lib/leads/sla.ts). Las columnas
-- at_risk / abandoned_at se conservan (se escriben explícitamente o se
-- derivan al leer), pero ya no las maneja un trigger.
--
-- Nota: los triggers ya fueron dropeados en 013 (no se recrearon); acá
-- eliminamos las funciones huérfanas de forma idempotente.
--
-- Además agrega lead_tasks.kind para distinguir tareas de reprogramaciones
-- de llamado ('callback').
-- ============================================================

BEGIN;

DROP TRIGGER  IF EXISTS trg_leads_at_risk   ON leads;
DROP TRIGGER  IF EXISTS trg_leads_abandoned ON leads;
DROP FUNCTION IF EXISTS update_at_risk();
DROP FUNCTION IF EXISTS update_abandoned();

ALTER TABLE lead_tasks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'task';
-- valores: 'task' | 'callback'

COMMIT;
