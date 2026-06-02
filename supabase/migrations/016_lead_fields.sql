-- ============================================================
-- 016_lead_fields.sql — Campos nuevos en leads
-- ============================================================
-- Agrega los campos de trazabilidad pedidos por el módulo 2:
--   localidad / provincia     → ubicación del lead
--   horario_preferencia       → cuándo prefiere ser contactado
--   tiene_usado               → ¿tiene auto para dar en parte de pago?
--   observaciones             → comentarios libres del vendedor
--   source_custom             → nombre del origen cuando source = 'Otro'
--                               (custom sources, reel específico, etc.)
-- ============================================================

BEGIN;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS localidad          text,
  ADD COLUMN IF NOT EXISTS provincia          text,
  ADD COLUMN IF NOT EXISTS horario_preferencia text,
  ADD COLUMN IF NOT EXISTS tiene_usado        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observaciones      text,
  ADD COLUMN IF NOT EXISTS source_custom      text;

COMMIT;
