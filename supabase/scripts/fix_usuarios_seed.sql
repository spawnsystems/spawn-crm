-- ============================================================
-- fix_usuarios_seed.sql
-- Corrige los usuarios que el trigger insertó con valores default.
-- Ejecutar en Supabase → SQL Editor UNA sola vez.
-- ============================================================

UPDATE usuarios SET
  nombre            = 'Spawn Admin',
  rol               = 'platform_admin',
  is_platform_admin = TRUE
WHERE id = '61125135-8d6e-48e2-a62f-5f6f1ef1583c';

UPDATE usuarios SET
  nombre = 'Carlos Méndez',
  rol    = 'dueno'
WHERE id = '46072d1c-954a-4ad9-ba1b-13a4bf4bb472';

UPDATE usuarios SET
  nombre = 'Laura Vega',
  rol    = 'gerente'
WHERE id = 'd6c29152-2a29-4d9e-88cf-087610367056';

UPDATE usuarios SET
  nombre = 'Marcos Ruiz',
  rol    = 'supervisor'
WHERE id = '37b30880-5bcd-46e0-889a-48c36630258d';

UPDATE usuarios SET
  nombre = 'Ana Torres',
  rol    = 'vendedor'
WHERE id = 'bb559bf4-0bf7-4501-957d-c492c7912add';

UPDATE usuarios SET
  nombre = 'Diego Soto',
  rol    = 'vendedor'
WHERE id = 'ea83dd26-3c32-4478-9c07-11ac243f46c4';

-- Verificación: deberías ver los 6 usuarios con roles y nombres correctos
SELECT id, email, nombre, rol, is_platform_admin FROM usuarios ORDER BY created_at;
