-- ============================================================
-- seed_leads_demo.sql — Leads de demo para Chevrolet Centro
-- Correr en Supabase SQL Editor después de 007_seed_dev.sql
--
-- Tenant:  aaaaaaaa-0000-0000-0000-000000000001
-- Vendor1: bb559bf4-0bf7-4501-957d-c492c7912add  (Ana Torres)
-- Vendor2: ea83dd26-3c32-4478-9c07-11ac243f46c4  (Diego Soto)
-- ============================================================

-- ── Leads ─────────────────────────────────────────────────────

INSERT INTO leads (
  id, tenant_id, nombre, telefono, email,
  modelo, source, status,
  est_value, days_in_stage, at_risk,
  last_contact_at, last_contact_critical,
  next_action, assigned_to, equipo_id,
  created_by, updated_by
) VALUES

-- Ana Torres — leads (vendor1)
(
  '1ead0001-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Rodrigo Fernández', '+54 9 11 3344-5566', 'rodrigo.fernandez@gmail.com',
  'Tracker', 'Meta Ads', 'Nuevo',
  18500000, 0, TRUE,
  NOW() - INTERVAL '30 hours', TRUE,
  'Primer contacto por WhatsApp',
  'bb559bf4-0bf7-4501-957d-c492c7912add', NULL,
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),
(
  '1ead0002-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Valeria Moreno', '+54 9 11 7788-9900', 'valeria.moreno@hotmail.com',
  'Onix Plus', 'Web', 'Contactado',
  14200000, 2, FALSE,
  NOW() - INTERVAL '4 hours', FALSE,
  'Enviar cotización formal',
  'bb559bf4-0bf7-4501-957d-c492c7912add', NULL,
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),
(
  '1ead0003-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Hernán Gutiérrez', '+54 9 11 2233-4455', 'hernan.g@gmail.com',
  'Captiva', 'Referido', 'Cotizado',
  24900000, 3, FALSE,
  NOW() - INTERVAL '2 hours', FALSE,
  'Hacer seguimiento de cotización',
  'bb559bf4-0bf7-4501-957d-c492c7912add', NULL,
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),
(
  '1ead0004-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Natalia Ibáñez', '+54 9 11 6655-4433', 'natalia.ibanez@yahoo.com',
  'Tracker', 'Mercado Libre', 'Test drive',
  18500000, 1, FALSE,
  NOW() - INTERVAL '1 hour', FALSE,
  'Confirmar test drive para el sábado',
  'bb559bf4-0bf7-4501-957d-c492c7912add', NULL,
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),
(
  '1ead0005-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Tomás Blanco', '+54 9 11 9988-7766', 'tomas.blanco@gmail.com',
  'Montana', 'Walk-in', 'Negociación',
  16800000, 2, FALSE,
  NOW() - INTERVAL '3 hours', FALSE,
  'Cerrar condiciones de financiación',
  'bb559bf4-0bf7-4501-957d-c492c7912add', NULL,
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),
(
  '1ead0006-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Claudia Romero', '+54 9 11 1122-3344', 'claudia.romero@gmail.com',
  'Onix Plus', 'Meta Ads', 'Cerrado',
  14200000, 5, FALSE,
  NOW() - INTERVAL '1 day', FALSE,
  'Coordinar entrega',
  'bb559bf4-0bf7-4501-957d-c492c7912add', NULL,
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),
(
  '1ead0007-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Facundo Peralta', '+54 9 11 5544-3322', NULL,
  'Tracker', 'Web', 'Nuevo',
  18500000, 1, TRUE,
  NOW() - INTERVAL '28 hours', TRUE,
  'Intentar contacto nuevamente',
  'bb559bf4-0bf7-4501-957d-c492c7912add', NULL,
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),

-- Diego Soto — leads (vendor2)
(
  '1ead0008-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Luciana Castro', '+54 9 11 8877-6655', 'luciana.castro@gmail.com',
  'Equinox EV', 'Meta Ads', 'Nuevo',
  35000000, 0, FALSE,
  NULL, FALSE,
  'Primer contacto — modelo eléctrico',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', NULL,
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
),
(
  '1ead0009-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Sebastián Ríos', '+54 9 11 4433-2211', 'sebarios@outlook.com',
  'Captiva', 'Referido', 'Contactado',
  24900000, 1, FALSE,
  NOW() - INTERVAL '5 hours', FALSE,
  'Enviar ficha técnica y comparativa',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', NULL,
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
),
(
  '1ead0010-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Gabriela Suárez', '+54 9 11 3322-1100', 'gabi.suarez@gmail.com',
  'Tracker', 'Mercado Libre', 'Cotizado',
  18500000, 4, TRUE,
  NOW() - INTERVAL '27 hours', TRUE,
  'Seguimiento urgente — cotización enviada hace 4 días',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', NULL,
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
),
(
  '1ead0011-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Andrés Molina', '+54 9 11 6677-8899', 'amolina@gmail.com',
  'Montana', 'Walk-in', 'Test drive',
  16800000, 2, FALSE,
  NOW() - INTERVAL '6 hours', FALSE,
  'Test drive programado para mañana',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', NULL,
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
),
(
  '1ead0012-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Paola Vega', '+54 9 11 2211-4433', 'paola.vega@yahoo.com',
  'Captiva', 'Web', 'Negociación',
  24900000, 3, FALSE,
  NOW() - INTERVAL '2 hours', FALSE,
  'Revisar opción de toma de usado',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', NULL,
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
),
(
  '1ead0013-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Ignacio Flores', '+54 9 11 9900-1122', 'nacho.flores@gmail.com',
  'Equinox EV', 'Meta Ads', 'Cerrado',
  35000000, 7, FALSE,
  NOW() - INTERVAL '2 days', FALSE,
  'Entrega realizada — pedir reseña',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', NULL,
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
),
(
  '1ead0014-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Martina Quiroga', '+54 9 11 7766-5544', 'mquiroga@gmail.com',
  'Onix Plus', 'Meta Ads', 'Cerrado',
  14200000, 4, FALSE,
  NOW() - INTERVAL '3 days', FALSE,
  'Seguimiento post-venta',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', NULL,
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
),

-- Sin asignar (Bandeja General)
(
  '1ead0015-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Roberto Acosta', '+54 9 11 1100-2233', NULL,
  'Tracker', 'Meta Ads', 'Nuevo',
  18500000, 0, FALSE,
  NULL, FALSE,
  'Asignar vendedor',
  NULL, NULL,
  'd6c29152-2a29-4d9e-88cf-087610367056', 'd6c29152-2a29-4d9e-88cf-087610367056'
),
(
  '1ead0016-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Silvina Ortiz', '+54 9 11 3300-4411', 'silvina.o@gmail.com',
  'Montana', 'Web', 'Nuevo',
  16800000, 0, FALSE,
  NULL, FALSE,
  'Asignar vendedor',
  NULL, NULL,
  'd6c29152-2a29-4d9e-88cf-087610367056', 'd6c29152-2a29-4d9e-88cf-087610367056'
);

-- ── Timeline entries para los leads principales ────────────────

INSERT INTO lead_timeline (tenant_id, lead_id, actor_id, event_type, title, description) VALUES

-- Lead 0001 — Rodrigo
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0001-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'lead_created', 'Lead creado', 'Desde Meta Ads'),

-- Lead 0002 — Valeria
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0002-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'lead_created', 'Lead creado', 'Desde Web'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0002-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'contacted', 'Contactado', 'WhatsApp enviado, respondió con interés'),

-- Lead 0003 — Hernán
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0003-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'lead_created', 'Lead creado', 'Referido por cliente anterior'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0003-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'contacted', 'Contactado', 'Llamada realizada, muy interesado'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0003-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'status_changed', 'Estado: Contactado → Cotizado', 'Cotización enviada con 3 opciones de financiación'),

-- Lead 0005 — Tomás (negociación)
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0005-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'lead_created', 'Lead creado', 'Walk-in en la concesionaria'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0005-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'contacted', 'Contactado', NULL),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0005-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'status_changed', 'Estado: Cotizado → Test drive', 'Test drive realizado, conforme con el vehículo'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0005-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'status_changed', 'Estado: Test drive → Negociación', 'Iniciada negociación de precio y financiación'),

-- Lead 0006 — Claudia (cerrado)
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0006-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'lead_created', 'Lead creado', 'Meta Ads'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0006-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'status_changed', 'Estado: Nuevo → Cerrado', 'Venta cerrada — Onix Plus en efectivo');

-- ── Notas para algunos leads ───────────────────────────────────

INSERT INTO lead_notes (tenant_id, lead_id, author_id, texto) VALUES
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0002-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add',
 'Cliente interesada en versión Premier. Tiene presupuesto ajustado — evaluar opciones de cuotas.'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0003-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add',
 'Referido por Carlos Méndez. Quiere Captiva para uso familiar, 5 personas. Interesado en garantía extendida.'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0005-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add',
 'Tiene Montana 2019 para entregar como parte de pago. Hay que tasarla antes de cerrar.'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0010-0000-0000-0000-000000000001',
 'ea83dd26-3c32-4478-9c07-11ac243f46c4',
 'Abrió el PDF de la cotización 3 veces. No respondió mensajes. Probar llamada directa hoy.'),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0012-0000-0000-0000-000000000001',
 'ea83dd26-3c32-4478-9c07-11ac243f46c4',
 'Tiene Corsa 2015 para entregar. Prefiere cuotas en pesos. Reunión pactada para el viernes.');

-- ── Tareas pendientes ──────────────────────────────────────────

INSERT INTO lead_tasks (tenant_id, lead_id, assigned_to, texto, done) VALUES
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0001-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'Primer contacto por WhatsApp — presentarse y consultar disponibilidad', FALSE),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0002-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'Enviar cotización formal con opciones de financiación', FALSE),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0003-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'Hacer seguimiento — confirmar recepción de cotización', FALSE),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0004-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'Confirmar test drive para el sábado 10:00 hs', FALSE),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0005-0000-0000-0000-000000000001',
 'bb559bf4-0bf7-4501-957d-c492c7912add', 'Tasar Montana 2019 antes del viernes', FALSE),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0008-0000-0000-0000-000000000001',
 'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'Contactar — lead nuevo, modelo eléctrico de alto valor', FALSE),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0010-0000-0000-0000-000000000001',
 'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'Llamar hoy — 4 días sin respuesta a la cotización', FALSE),
('aaaaaaaa-0000-0000-0000-000000000001', '1ead0012-0000-0000-0000-000000000001',
 'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'Reunión viernes — llevar propuesta de toma de usado', FALSE);

-- ── Leads abandonados (para pantalla de Rescate) ──────────────

INSERT INTO leads (
  id, tenant_id, nombre, telefono, email,
  modelo, source, status,
  est_value, days_in_stage,
  at_risk, last_contact_at, last_contact_critical,
  abandoned_at, rescue_category,
  assigned_to, created_by, updated_by
) VALUES
(
  '1ead0020-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Fernanda Quiroga', '+54 9 11 1111-2222', 'fquiroga@gmail.com',
  'Captiva', 'Meta Ads', 'Cotizado',
  24900000, 18, TRUE,
  NOW() - INTERVAL '18 days', TRUE,
  NOW() - INTERVAL '18 days', 'cotizado_sin_respuesta',
  'bb559bf4-0bf7-4501-957d-c492c7912add',
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),
(
  '1ead0021-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Gastón Herrera', '+54 9 11 3333-4444', NULL,
  'Equinox EV', 'Web', 'Test drive',
  35000000, 16, TRUE,
  NOW() - INTERVAL '16 days', TRUE,
  NOW() - INTERVAL '16 days', 'no_se_presento',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
),
(
  '1ead0022-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Sergio Molina', '+54 9 11 5555-6666', 'sergio.molina@yahoo.com',
  'Captiva', 'Referido', 'Negociación',
  24900000, 21, TRUE,
  NOW() - INTERVAL '21 days', TRUE,
  NOW() - INTERVAL '21 days', 'negociacion_abandonada',
  'bb559bf4-0bf7-4501-957d-c492c7912add',
  'bb559bf4-0bf7-4501-957d-c492c7912add', 'bb559bf4-0bf7-4501-957d-c492c7912add'
),
(
  '1ead0023-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Daniela Suárez', '+54 9 11 7777-8888', 'dsuarez@gmail.com',
  'Tracker', 'Meta Ads', 'Cotizado',
  18500000, 17, TRUE,
  NOW() - INTERVAL '17 days', TRUE,
  NOW() - INTERVAL '17 days', 'cotizado_sin_respuesta',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4',
  'ea83dd26-3c32-4478-9c07-11ac243f46c4', 'ea83dd26-3c32-4478-9c07-11ac243f46c4'
);
