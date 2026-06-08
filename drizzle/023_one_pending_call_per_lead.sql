-- 023_one_pending_call_per_lead.sql
-- Una sola llamada PENDIENTE por lead (espeja el constraint de citas).
--
-- Modelo: una llamada es la "próxima interacción telefónica". El flujo es una
-- cadena secuencial (agendo → registro → nace la siguiente), no un set paralelo.
-- Estados de una llamada:
--   - pendiente  → realizada_at IS NULL  AND canceled_at IS NULL
--   - realizada  → realizada_at IS NOT NULL
--   - cancelada  → canceled_at  IS NOT NULL  (reemplazada por una nueva agenda)
--
-- Cuando el flujo generaría una segunda pendiente (agendar manual sobre un lead
-- que ya tiene una, o registrar una llamada ad-hoc que termina en próxima
-- llamada / reintento), la app cancela la pendiente anterior y avisa al usuario.

BEGIN;

-- 1) Nueva columna para marcar llamadas canceladas (reemplazadas).
ALTER TABLE lead_calls
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

-- 2) Sanear datos previos: si un lead ya tiene >1 pendiente, conservar solo la
--    más reciente (por scheduled_at, desempate por created_at) y cancelar el resto.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lead_id
           ORDER BY scheduled_at DESC, created_at DESC
         ) AS rn
  FROM lead_calls
  WHERE realizada_at IS NULL
    AND canceled_at IS NULL
)
UPDATE lead_calls lc
SET    canceled_at = now()
FROM   ranked r
WHERE  lc.id = r.id
  AND  r.rn > 1;

-- 3) Garantía dura: a lo sumo una llamada viva (pendiente) por lead.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_pending_call_per_lead
  ON lead_calls (lead_id)
  WHERE realizada_at IS NULL AND canceled_at IS NULL;

COMMIT;
