-- 026 — Nuevos módulos seleccionables por tenant.
-- El catálogo de módulos ahora cubre las secciones reales de la app. Sumamos
-- las claves que faltaban para poder prender/apagar por tenant desde el panel
-- de plataforma. (test_drive / inventario / reportes quedan en el enum por
-- compatibilidad pero ya no se ofrecen.)
--
-- NOTA: ALTER TYPE ... ADD VALUE no puede usarse en la misma transacción donde
-- se lo agrega. Correr este archivo tal cual (sin envolver en BEGIN/COMMIT).

ALTER TYPE module_key ADD VALUE IF NOT EXISTS 'citas';
ALTER TYPE module_key ADD VALUE IF NOT EXISTS 'ventas';
ALTER TYPE module_key ADD VALUE IF NOT EXISTS 'historial';
ALTER TYPE module_key ADD VALUE IF NOT EXISTS 'auditoria';
