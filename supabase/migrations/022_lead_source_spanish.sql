-- ─────────────────────────────────────────────────────────────────────────────
-- 022 — Fuentes de leads en español + nuevo valor "Contacto directo"
--
-- Renombra los valores del enum lead_source que estaban en inglés/mezclado
-- y agrega el nuevo origen "Contacto directo" (cliente contactado fuera del
-- local: en la calle, en un evento, expo, etc.).
--
-- ALTER TYPE ... RENAME VALUE es un DDL que actualiza el tipo en-place; los
-- registros existentes NO se tocan (Postgres almacena el label, no un ordinal).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TYPE lead_source RENAME VALUE 'Walk-in' TO 'Visita al local';
ALTER TYPE lead_source RENAME VALUE 'Web'     TO 'Sitio web';

-- ADD VALUE no admite transacciones en versiones antiguas de Postgres, pero
-- Supabase corre ≥ 15 donde sí está soportado dentro de BEGIN/COMMIT.
ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'Contacto directo';

COMMIT;
