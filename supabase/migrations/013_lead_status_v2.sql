-- ============================================================
-- 013_lead_status_v2.sql — Migrar enum lead_status de 5→11 valores
-- ============================================================
--
-- ANTES:   'Nuevo','Contactado','Citado','Cerrado','Para rescate'
-- DESPUÉS (activos):  'GESTION','HORARIO ASIGNADO','ENTREVISTA PACTADA','CIERRE','VENTA'
--         (baja):     'NO CONTESTA','NO INTERESADO','INCONTACTABLE','YA COMPRO','DATO ERRONEO','DERIVAR'
--
-- Mapeo:
--   'Cerrado'                       → 'VENTA'
--   'Citado'                        → 'ENTREVISTA PACTADA'
--   'Nuevo','Contactado','Para rescate' → 'GESTION'  (Para rescate conserva abandoned_at)
--
-- Además agrega columnas baja_motivo / baja_at para el flujo "Dar de baja".
-- Patrón create-new-swap-drop (igual que 011).
-- ============================================================

BEGIN;

-- 1) Crear el enum nuevo (11 valores)
CREATE TYPE lead_status_new AS ENUM (
  'GESTION',
  'HORARIO ASIGNADO',
  'ENTREVISTA PACTADA',
  'CIERRE',
  'VENTA',
  'NO CONTESTA',
  'NO INTERESADO',
  'INCONTACTABLE',
  'YA COMPRO',
  'DATO ERRONEO',
  'DERIVAR'
);

-- 2) Columna temporal con el tipo nuevo + columnas del flujo de baja
ALTER TABLE leads ADD COLUMN status_new lead_status_new;
ALTER TABLE leads ADD COLUMN baja_motivo text;
ALTER TABLE leads ADD COLUMN baja_at timestamptz;

-- 3) Backfill en orden de prioridad (último UPDATE como fallback)
UPDATE leads SET status_new = 'VENTA'              WHERE status = 'Cerrado';
UPDATE leads SET status_new = 'ENTREVISTA PACTADA' WHERE status = 'Citado'                                   AND status_new IS NULL;
UPDATE leads SET status_new = 'GESTION'            WHERE status IN ('Nuevo','Contactado','Para rescate')      AND status_new IS NULL;

-- Fallback de seguridad
UPDATE leads SET status_new = 'GESTION' WHERE status_new IS NULL;

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
ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'GESTION';

-- 6) Drop enum viejo y rename nuevo
DROP TYPE lead_status;
ALTER TYPE lead_status_new RENAME TO lead_status;

-- 7) Recrear solo los triggers enum-agnósticos (stage_reset, days_in_stage).
--    Los triggers at_risk / abandoned se eliminan definitivamente: el cálculo
--    de "Demorado" y la bandeja de rescate pasan a derivarse en la capa de app
--    (ver migración 015 + lib/leads/sla.ts).
CREATE TRIGGER trg_leads_stage_reset
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION reset_stage_entered_at();

CREATE TRIGGER trg_leads_days_in_stage
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_days_in_stage();

COMMIT;
