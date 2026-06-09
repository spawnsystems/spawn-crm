-- 024 — Estado inicial NUEVO para leads
--
-- Agrega el valor 'NUEVO' al enum lead_status como estado inicial (antes de
-- GESTION) y lo deja como default de la columna leads.status.
--
-- ⚠️ IMPORTANTE — correr en DOS PASOS separados.
--    Postgres no permite USAR un valor de enum recién agregado dentro de la
--    MISMA transacción que lo agregó. El SQL editor de Supabase envuelve cada
--    ejecución en una transacción, así que:
--      1. Pegá y ejecutá SOLO el PASO 1.
--      2. Después pegá y ejecutá el PASO 2.

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1 — agregar el valor al enum
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'NUEVO' BEFORE 'GESTION';

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2 — default + backfill (ejecutar luego de confirmar el PASO 1)
-- ─────────────────────────────────────────────────────────────────────────────
-- Nuevos leads arrancan en NUEVO.
ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'NUEVO';

-- Backfill OPCIONAL: los leads que están en GESTION pero nunca tuvieron un
-- contacto registrado son, en realidad, "nuevos". Descomentá si querés migrarlos.
-- UPDATE leads
--    SET status = 'NUEVO'
--  WHERE status = 'GESTION'
--    AND last_contact_at IS NULL;
