-- ============================================================
-- DROP ALL — Limpia la base de datos por completo
-- ⚠️  IRREVERSIBLE. Correr solo en desarrollo / reset inicial.
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Eliminar TODAS las tablas del schema "public"
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $$;

-- ============================================================
-- 3. Eliminar TODAS las funciones del schema "public"
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ns.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace ns ON p.pronamespace = ns.oid
    WHERE ns.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.name) || '(' || r.args || ') CASCADE';
  END LOOP;
END $$;

-- ============================================================
-- 4. Eliminar TODOS los tipos / enums del schema "public"
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.typname AS name
    FROM pg_type t
    JOIN pg_namespace ns ON t.typnamespace = ns.oid
    WHERE ns.nspname = 'public'
      AND t.typtype = 'e'   -- solo enums
  LOOP
    EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.name) || ' CASCADE';
  END LOOP;
END $$;

-- ============================================================
-- 5. Eliminar secuencias huérfanas (por si quedaron)
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
  END LOOP;
END $$;

-- ============================================================
-- 6. Eliminar vistas (si las hubiera)
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  LOOP
    EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
  END LOOP;
END $$;

-- ============================================================
-- Verificación: estas queries deberían devolver 0 filas
-- ============================================================
SELECT tablename   FROM pg_tables        WHERE schemaname = 'public';
SELECT proname     FROM pg_proc p JOIN pg_namespace ns ON p.pronamespace = ns.oid WHERE ns.nspname = 'public';
SELECT typname     FROM pg_type t JOIN pg_namespace ns ON t.typnamespace  = ns.oid WHERE ns.nspname = 'public' AND t.typtype = 'e';
