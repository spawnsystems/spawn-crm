-- ============================================================
-- 007_seed_dev.sql — Datos de desarrollo/demo
-- ⚠️  Solo correr en entorno de desarrollo.
--
-- IMPORTANTE: Primero creá los usuarios en Supabase Auth (Authentication → Users)
-- con los emails de abajo, luego corrés este script.
-- Los UUIDs deben coincidir con los de auth.users.
--
-- Para el seed inicial podés usar UUIDs ficticios si los vas a reemplazar,
-- o correr el script create-platform-admin.ts para el primer admin real.
-- ============================================================

-- Para correr este seed necesitás reemplazar los UUIDs con los reales
-- de tus usuarios de auth. Este script usa placeholders descriptivos.

-- ── Tenant demo ───────────────────────────────────────────────
INSERT INTO tenants (id, nombre, concesionaria, color_primario, activo, plan_key)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Chevrolet Centro',
  'Chevrolet',
  '#f7a800',
  TRUE,
  'pro'
);

-- ── Modelos de vehículo demo ──────────────────────────────────
INSERT INTO modelos_vehiculo (tenant_id, nombre, motor, transmision, consumo, precio, stock, colores)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Tracker', '1.2T Turbo', 'Automática 6 vel', '13.5 km/l', 18500000, 4,
   ARRAY['Blanco Artic', 'Negro Onyx', 'Gris Grafito', 'Rojo Rally']),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Onix Plus', '1.0T Turbo', 'Automática CVT', '15.2 km/l', 14200000, 7,
   ARRAY['Blanco Summit', 'Negro Midnight', 'Azul Topacio']),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Captiva', '1.5T Turbo', 'Automática 6 vel', '11.8 km/l', 24900000, 2,
   ARRAY['Blanco Artic', 'Gris Grafito']),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Montana', '1.2T Turbo', 'Manual 6 vel', '14.0 km/l', 16800000, 5,
   ARRAY['Blanco Summit', 'Negro Onyx', 'Gris Grafito', 'Plata']),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Equinox EV', 'Eléctrico 210kW', 'Automática 1 vel', '5.4 kWh/100km', 35000000, 1,
   ARRAY['Blanco Artic', 'Azul Estelar']);

-- ── Nota para el seed de usuarios ─────────────────────────────
-- Una vez que tengas los UUIDs reales de auth.users, ejecutá:
--
-- INSERT INTO usuarios (id, email, nombre, rol, is_platform_admin) VALUES
--   ('<uuid-del-admin>', 'spawn.hq.main@gmail.com', 'Spawn Admin', 'platform_admin', TRUE),
--   ('<uuid-del-dueno>', 'dueno@chevroletcentro.com', 'Carlos Méndez', 'dueno', FALSE),
--   ('<uuid-gerente>',   'gerente@chevroletcentro.com', 'Laura Vega', 'gerente', FALSE),
--   ('<uuid-supervisor1>', 'super1@chevroletcentro.com', 'Marcos Ruiz', 'supervisor', FALSE),
--   ('<uuid-vendedor1>',  'vendor1@chevroletcentro.com', 'Ana Torres', 'vendedor', FALSE),
--   ('<uuid-vendedor2>',  'vendor2@chevroletcentro.com', 'Diego Soto', 'vendedor', FALSE);
--
-- Luego los memberships:
-- INSERT INTO tenant_members (tenant_id, user_id, rol, invitation_status) VALUES
--   ('aaaaaaaa-0000-0000-0000-000000000001', '<uuid-del-dueno>',    'dueno',    'accepted'),
--   ('aaaaaaaa-0000-0000-0000-000000000001', '<uuid-gerente>',      'gerente',  'accepted'),
--   ('aaaaaaaa-0000-0000-0000-000000000001', '<uuid-supervisor1>',  'supervisor','accepted'),
--   ('aaaaaaaa-0000-0000-0000-000000000001', '<uuid-vendedor1>',    'vendedor', 'accepted'),
--   ('aaaaaaaa-0000-0000-0000-000000000001', '<uuid-vendedor2>',    'vendedor', 'accepted');
