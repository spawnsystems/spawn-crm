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
INSERT INTO usuarios (id, email, nombre, rol, is_platform_admin) VALUES
   ('61125135-8d6e-48e2-a62f-5f6f1ef1583c', 'spawn.hq.main@gmail.com', 'Spawn Admin', 'platform_admin', TRUE),
   ('46072d1c-954a-4ad9-ba1b-13a4bf4bb472', 'dueno@luxmar.com', 'Carlos Méndez', 'dueno', FALSE),
   ('d6c29152-2a29-4d9e-88cf-087610367056',   'gerente@luxmar.com', 'Laura Vega', 'gerente', FALSE),
   ('37b30880-5bcd-46e0-889a-48c36630258d', 'super1@luxmar.com', 'Marcos Ruiz', 'supervisor', FALSE),
   ('bb559bf4-0bf7-4501-957d-c492c7912add',  'vendor1@luxmar.com', 'Ana Torres', 'vendedor', FALSE),
   ('ea83dd26-3c32-4478-9c07-11ac243f46c4',  'vendor2@luxmar.com', 'Diego Soto', 'vendedor', FALSE);

-- Luego los memberships:
 INSERT INTO tenant_members (tenant_id, user_id, rol, invitation_status) VALUES
   ('aaaaaaaa-0000-0000-0000-000000000001', '46072d1c-954a-4ad9-ba1b-13a4bf4bb472',    'dueno',    'accepted'),
   ('aaaaaaaa-0000-0000-0000-000000000001', 'd6c29152-2a29-4d9e-88cf-087610367056',      'gerente',  'accepted'),
   ('aaaaaaaa-0000-0000-0000-000000000001', '37b30880-5bcd-46e0-889a-48c36630258d',  'supervisor','accepted'),
   ('aaaaaaaa-0000-0000-0000-000000000001', 'bb559bf4-0bf7-4501-957d-c492c7912add',    'vendedor', 'accepted'),
   ('aaaaaaaa-0000-0000-0000-000000000001', 'ea83dd26-3c32-4478-9c07-11ac243f46c4',    'vendedor', 'accepted');
