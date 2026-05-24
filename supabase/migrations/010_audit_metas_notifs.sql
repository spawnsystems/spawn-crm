-- ============================================================
-- 010_audit_metas_notifs.sql
-- Nuevas tablas: audit_logs, metas_mensuales, email_log,
--                lead_sources_custom, notification_prefs
-- Extensión: modelos_vehiculo (caracteristicas, activo)
-- ============================================================

-- ── audit_logs ────────────────────────────────────────────────
-- Registro de todas las acciones del sistema.
-- tenant_id puede ser NULL para acciones de platform_admin.
-- visible_to_dueno controla qué ve el dueño en la UI.

CREATE TABLE audit_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id         UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  action           TEXT        NOT NULL,
  -- Ejemplos: lead.create | lead.assign | lead.status_change |
  --           lead.mark_lost | lead.contacted | user.invite
  entity           TEXT        NOT NULL,
  -- lead | user | tenant | equipo | modelo | meta | source
  entity_id        UUID,
  meta             JSONB,
  visible_to_dueno BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_tenant_created ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX audit_logs_actor          ON audit_logs (actor_id);
CREATE INDEX audit_logs_entity         ON audit_logs (entity, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Dueños y platform_admin ven todos los logs de su tenant
CREATE POLICY "audit_logs_select_dueno" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_dueno_o_admin()
  );

-- Vendedores/supervisores/gerentes solo ven los no-exclusivos
CREATE POLICY "audit_logs_select_member" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
    AND visible_to_dueno = FALSE
  );

-- INSERT se hace siempre desde service role (dbAdmin) → sin política necesaria.
-- Pero la definimos para que service role funcione sin RLS bypass manual.
CREATE POLICY "audit_logs_insert_service" ON audit_logs
  FOR INSERT TO service_role
  WITH CHECK (TRUE);

-- ── metas_mensuales ───────────────────────────────────────────
-- Meta de ventas (unidades + monto) por vendedor por mes.
-- UNIQUE (tenant_id, user_id, anio, mes) → upsert seguro.

CREATE TABLE metas_mensuales (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  anio         INTEGER     NOT NULL,
  mes          INTEGER     NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_ventas  INTEGER     NOT NULL DEFAULT 0,
  meta_monto   NUMERIC(14,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, anio, mes)
);

CREATE INDEX metas_mensuales_tenant_periodo ON metas_mensuales (tenant_id, anio, mes);

ALTER TABLE metas_mensuales ENABLE ROW LEVEL SECURITY;

-- Todos los miembros activos del tenant pueden ver las metas
CREATE POLICY "metas_select" ON metas_mensuales
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND es_usuario_activo());

-- Solo dueño puede crear/editar metas
CREATE POLICY "metas_insert" ON metas_mensuales
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND es_dueno_o_admin());

CREATE POLICY "metas_update" ON metas_mensuales
  FOR UPDATE TO authenticated
  USING    (tenant_id = current_tenant_id() AND es_dueno_o_admin())
  WITH CHECK (tenant_id = current_tenant_id() AND es_dueno_o_admin());

CREATE POLICY "metas_delete" ON metas_mensuales
  FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND es_dueno_o_admin());

-- ── email_log ─────────────────────────────────────────────────
-- Registro de emails enviados vía Resend.
-- El webhook de Resend actualiza status (delivered / bounced / etc.)

CREATE TABLE email_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        REFERENCES tenants(id) ON DELETE CASCADE,
  to_email   TEXT        NOT NULL,
  kind       TEXT        NOT NULL,
  -- invitation | task_reminder | lead_at_risk | daily_digest
  subject    TEXT        NOT NULL,
  resend_id  TEXT,
  status     TEXT        NOT NULL DEFAULT 'queued',
  -- queued | sent | delivered | bounced | complained | failed
  error      TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_log_tenant_created ON email_log (tenant_id, created_at DESC);
CREATE INDEX email_log_resend_id      ON email_log (resend_id) WHERE resend_id IS NOT NULL;

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

-- Solo dueño ve los logs de email de su tenant
CREATE POLICY "email_log_select" ON email_log
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND es_dueno_o_admin());

-- Escritura solo desde service role (Resend webhook usa service key)
CREATE POLICY "email_log_insert_service" ON email_log
  FOR INSERT TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "email_log_update_service" ON email_log
  FOR UPDATE TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ── lead_sources_custom ───────────────────────────────────────
-- Fuentes de leads definidas por el tenant (además del enum global).
-- UNIQUE (tenant_id, nombre) evita duplicados.

CREATE TABLE lead_sources_custom (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre     TEXT        NOT NULL,
  activo     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, nombre)
);

CREATE INDEX lead_sources_custom_tenant ON lead_sources_custom (tenant_id, activo);

ALTER TABLE lead_sources_custom ENABLE ROW LEVEL SECURITY;

-- Todos los miembros activos pueden ver las fuentes de su tenant
CREATE POLICY "sources_select" ON lead_sources_custom
  FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND es_usuario_activo());

-- Solo gerente+ puede gestionar fuentes
CREATE POLICY "sources_insert" ON lead_sources_custom
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND tiene_rol_o_mayor('gerente'));

CREATE POLICY "sources_update" ON lead_sources_custom
  FOR UPDATE TO authenticated
  USING    (tenant_id = current_tenant_id() AND tiene_rol_o_mayor('gerente'))
  WITH CHECK (tenant_id = current_tenant_id() AND tiene_rol_o_mayor('gerente'));

CREATE POLICY "sources_delete" ON lead_sources_custom
  FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND tiene_rol_o_mayor('gerente'));

-- ── notification_prefs ────────────────────────────────────────
-- Preferencias de notificación por usuario (1 row por usuario).
-- user_id es PK → upsert simple.

CREATE TABLE notification_prefs (
  user_id              UUID        PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  email_task_reminder  BOOLEAN     NOT NULL DEFAULT TRUE,
  email_lead_at_risk   BOOLEAN     NOT NULL DEFAULT TRUE,
  email_daily_digest   BOOLEAN     NOT NULL DEFAULT FALSE,
  sound_enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_prefs ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve y edita sus propias preferencias
CREATE POLICY "notif_prefs_select" ON notification_prefs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_prefs_insert" ON notification_prefs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_prefs_update" ON notification_prefs
  FOR UPDATE TO authenticated
  USING    (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── modelos_vehiculo — extensión ──────────────────────────────
-- Agregar caracteristicas JSONB y activo BOOLEAN.
-- { anio, segmento, equipamiento[], badge, descripcion }

ALTER TABLE modelos_vehiculo
  ADD COLUMN IF NOT EXISTS caracteristicas JSONB,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX modelos_vehiculo_tenant_activo
  ON modelos_vehiculo (tenant_id, activo)
  WHERE activo = TRUE;
