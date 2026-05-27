-- ============================================================
-- 011_lead_status_rework.sql — Migrar enum lead_status de 7→5 valores
-- ============================================================
--
-- ANTES: 'Nuevo','Contactado','Cotizado','Test drive','Negociación','Cerrado','Perdido'
-- DESPUÉS: 'Nuevo','Contactado','Citado','Cerrado','Para rescate'
--
-- Mapeo:
--   'Cerrado'                                          → 'Cerrado'
--   'Perdido' OR abandoned_at IS NOT NULL              → 'Para rescate'
--   'Test drive', 'Negociación'                        → 'Citado'
--   'Cotizado'                                         → 'Contactado'
--   'Nuevo'                                            → 'Nuevo'
--
-- Postgres no permite remover valores de un enum, así que creamos un enum
-- nuevo y hacemos swap en la columna.
-- ============================================================

BEGIN;

-- 1) Crear el enum nuevo
CREATE TYPE lead_status_new AS ENUM (
  'Nuevo',
  'Contactado',
  'Citado',
  'Cerrado',
  'Para rescate'
);

-- 2) Agregar columna temporal con el tipo nuevo
ALTER TABLE leads ADD COLUMN status_new lead_status_new;

-- 3) Backfill en orden de prioridad (último UPDATE como fallback)
--    Importante: hacer en este orden para que las prioridades se respeten.
UPDATE leads SET status_new = 'Cerrado'      WHERE status = 'Cerrado';
UPDATE leads SET status_new = 'Para rescate' WHERE status = 'Perdido' OR abandoned_at IS NOT NULL;
UPDATE leads SET status_new = 'Citado'       WHERE status IN ('Test drive', 'Negociación') AND status_new IS NULL;
UPDATE leads SET status_new = 'Contactado'   WHERE status = 'Cotizado'                     AND status_new IS NULL;
UPDATE leads SET status_new = 'Nuevo'        WHERE status = 'Nuevo'                         AND status_new IS NULL;

-- Fallback de seguridad
UPDATE leads SET status_new = 'Contactado' WHERE status_new IS NULL;

-- 4) Drop triggers que referencian la columna status vieja
DROP TRIGGER IF EXISTS trg_leads_stage_reset   ON leads;
DROP TRIGGER IF EXISTS trg_leads_days_in_stage ON leads;
DROP TRIGGER IF EXISTS trg_leads_at_risk       ON leads;
DROP TRIGGER IF EXISTS trg_leads_abandoned     ON leads;

-- 5) Drop default, drop columna vieja, rename, set default + not null
ALTER TABLE leads ALTER COLUMN status DROP DEFAULT;
ALTER TABLE leads DROP COLUMN status;
ALTER TABLE leads RENAME COLUMN status_new TO status;
ALTER TABLE leads ALTER COLUMN status SET NOT NULL;
ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'Nuevo';

-- 6) Drop enum viejo y rename nuevo
DROP TYPE lead_status;
ALTER TYPE lead_status_new RENAME TO lead_status;

-- 7) Recrear los triggers ─ los de stage_reset / days_in_stage / at_risk
--    quedan igual; el de abandoned cambia en la migración 012.
CREATE TRIGGER trg_leads_stage_reset
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION reset_stage_entered_at();

CREATE TRIGGER trg_leads_days_in_stage
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_days_in_stage();

CREATE TRIGGER trg_leads_at_risk
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_at_risk();

-- (el trg_leads_abandoned se recrea en 012_triggers_rework.sql con la nueva lógica)

COMMIT;
