-- ════════════════════════════════════════════════════════════════════════════
-- Offboarding retroactivo de miembros ya dados de baja (tenant_members.activo=false)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Arregla el trabajo que quedó huérfano cuando se dieron de baja vendedores sin
-- liberar sus leads/citas/traspasos. Replica lo que ahora hace el código en
-- lib/members/offboarding.ts, pero para los miembros inactivos que existen HOY.
--
-- Hace, por cada miembro inactivo (en el tenant donde está inactivo):
--   1) Sus leads ACTIVOS → "Sin asignar" (assigned_to=NULL, conserva equipo_id).
--   2) Sus citas 'programada' → 'cancelada'.
--   3) Sus traspasos 'pendiente' → 'cancelada'.
-- Los leads terminales (VENTA / baja) NO se tocan (registro histórico).
--
-- Es idempotente: correrlo dos veces no cambia nada (los leads ya quedaron sin
-- asignar, las citas ya están canceladas, etc.).
--
-- ── PASO 1 (opcional): ver el alcance antes de aplicar ───────────────────────
-- SELECT tm.tenant_id, tm.user_id, u.nombre,
--        count(*) FILTER (WHERE l.id IS NOT NULL) AS leads_a_liberar
-- FROM tenant_members tm
-- JOIN usuarios u ON u.id = tm.user_id
-- LEFT JOIN leads l
--   ON l.tenant_id = tm.tenant_id AND l.assigned_to = tm.user_id
--   AND l.status NOT IN ('VENTA','NO CONTESTA','NO INTERESADO','INCONTACTABLE','YA COMPRO','DATO ERRONEO','DERIVAR')
-- WHERE tm.activo = false
-- GROUP BY tm.tenant_id, tm.user_id, u.nombre;

-- ── PASO 2: aplicar ──────────────────────────────────────────────────────────
BEGIN;

-- 1) Leads activos de miembros inactivos → "Sin asignar" (conserva equipo_id)
WITH liberados AS (
  UPDATE leads l
  SET assigned_to = NULL, updated_at = now()
  FROM tenant_members tm
  WHERE tm.tenant_id = l.tenant_id
    AND tm.user_id   = l.assigned_to
    AND tm.activo    = false
    AND l.status NOT IN ('VENTA','NO CONTESTA','NO INTERESADO','INCONTACTABLE','YA COMPRO','DATO ERRONEO','DERIVAR')
  RETURNING l.id, l.tenant_id
)
INSERT INTO lead_timeline (tenant_id, lead_id, event_type, title)
SELECT tenant_id, id, 'reassigned', 'Liberado a "Sin asignar" (baja del responsable)'
FROM liberados;

-- 2) Citas programadas de miembros inactivos → canceladas
UPDATE lead_appointments a
SET status = 'cancelada', updated_at = now()
FROM tenant_members tm
WHERE tm.tenant_id = a.tenant_id
  AND tm.user_id   = a.vendedor_id
  AND tm.activo    = false
  AND a.status     = 'programada';

-- 3) Traspasos pendientes que involucran a miembros inactivos → cancelados
UPDATE lead_transfers t
SET status = 'cancelada', responded_at = now()
FROM tenant_members tm
WHERE tm.tenant_id = t.tenant_id
  AND tm.activo    = false
  AND tm.user_id IN (t.from_user_id, t.to_user_id)
  AND t.status     = 'pendiente';

COMMIT;

-- ── PASO 3 (opcional, ACCESO): revocar login de usuarios sin acceso ──────────
-- Toca el schema de auth de Supabase. Solo banea usuarios que NO tienen NINGUNA
-- membresía activa (en ningún tenant) y que no son platform_admin. Esto invalida
-- sus sesiones y les bloquea nuevos logins. Corré este bloque por separado.
--
-- BEGIN;
--   -- Marcar usuarios.activo=false para los huérfanos (sin membresía activa)
--   UPDATE usuarios u
--   SET activo = false
--   WHERE u.is_platform_admin = false
--     AND EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.user_id = u.id)
--     AND NOT EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.user_id = u.id AND tm.activo = true);
--
--   -- Banear su login en Supabase Auth (invalida sesiones + bloquea ingreso)
--   UPDATE auth.users au
--   SET banned_until = now() + interval '100 years'
--   WHERE EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.user_id = au.id)
--     AND NOT EXISTS (SELECT 1 FROM tenant_members tm WHERE tm.user_id = au.id AND tm.activo = true)
--     AND au.id NOT IN (SELECT id FROM usuarios WHERE is_platform_admin = true);
-- COMMIT;
