-- ============================================================
-- 017_appointment_tipos_v2.sql — Migrar enum appointment_tipo
-- ============================================================
-- ANTES: 'test_drive','visita_showroom','videollamada','entrega'
-- DESPUÉS: 'videollamada','visita_showroom','cierre'
--
-- Mapeo:
--   test_drive  → visita_showroom  (una visita al showroom incluye el test)
--   entrega     → cierre           (la entrega es el cierre del proceso)
--   videollamada → videollamada    (sin cambio)
--   visita_showroom → visita_showroom (sin cambio)
--
-- Patrón create-new-swap-drop (igual que 011 y 013).
-- ============================================================

BEGIN;

CREATE TYPE appointment_tipo_new AS ENUM (
  'videollamada',
  'visita_showroom',
  'cierre'
);

ALTER TABLE lead_appointments ADD COLUMN tipo_new appointment_tipo_new;

UPDATE lead_appointments SET tipo_new = 'cierre'           WHERE tipo = 'entrega';
UPDATE lead_appointments SET tipo_new = 'visita_showroom'  WHERE tipo = 'test_drive';
UPDATE lead_appointments SET tipo_new = 'videollamada'     WHERE tipo = 'videollamada'   AND tipo_new IS NULL;
UPDATE lead_appointments SET tipo_new = 'visita_showroom'  WHERE tipo = 'visita_showroom' AND tipo_new IS NULL;
UPDATE lead_appointments SET tipo_new = 'visita_showroom'  WHERE tipo_new IS NULL; -- fallback

ALTER TABLE lead_appointments ALTER COLUMN tipo_new SET NOT NULL;
ALTER TABLE lead_appointments DROP COLUMN tipo;
ALTER TABLE lead_appointments RENAME COLUMN tipo_new TO tipo;

DROP TYPE appointment_tipo;
ALTER TYPE appointment_tipo_new RENAME TO appointment_tipo;

COMMIT;
