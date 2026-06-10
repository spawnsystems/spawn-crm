-- 027 — Limpieza de "modelos fantasma" cargados como workaround.
--
-- Algunos tenants, al no tener una opción nativa "Sin definir", crearon un
-- modelo en el catálogo (modelos_vehiculo) con un nombre tipo "SIN DEFINIR".
-- Ahora el lead puede entrar sin modelo (modelo = NULL) y la UI muestra
-- "Sin definir", así que esos modelos fantasma se pueden retirar.
--
-- IMPORTANTE: leads.modelo es TEXTO LIBRE (no hay FK), así que no se rompe nada.
-- Corré los pasos en orden y AJUSTÁ el nombre exacto antes de ejecutar.

-- ── PASO 1 — Descubrir los modelos fantasma cargados ──────────────────────────
-- Revisá el resultado para confirmar el/los nombre(s) exacto(s) antes de seguir.
SELECT id, tenant_id, nombre, activo
FROM modelos_vehiculo
WHERE nombre ILIKE '%defin%'      -- "sin definir", "a definir", "no definido"...
   OR nombre ILIKE '%no sabe%'
   OR nombre ILIKE '%a confirmar%'
   OR nombre ILIKE '%consultar%';

-- ── PASO 2 — Normalizar los leads que apuntan a esos modelos → NULL ────────────
-- Ajustá la lista de nombres a lo que viste en el PASO 1.
UPDATE leads
SET modelo = NULL, updated_at = now()
WHERE TRIM(modelo) ILIKE ANY (ARRAY['sin definir', 'a definir', 'no definido', 'no sabe']);

-- ── PASO 3 — Retirar el modelo fantasma del catálogo ──────────────────────────
-- Lo desactivamos (no lo borramos) por las dudas. Si preferís borrarlo, usá
-- DELETE en vez de UPDATE.
UPDATE modelos_vehiculo
SET activo = false, updated_at = now()
WHERE TRIM(nombre) ILIKE ANY (ARRAY['sin definir', 'a definir', 'no definido', 'no sabe']);

-- ── Verificación ──────────────────────────────────────────────────────────────
-- SELECT count(*) FROM leads WHERE modelo IS NULL;                  -- leads "Sin definir"
-- SELECT nombre, activo FROM modelos_vehiculo WHERE activo = false; -- modelos retirados
