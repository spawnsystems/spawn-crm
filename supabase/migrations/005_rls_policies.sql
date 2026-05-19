-- ============================================================
-- 005_rls_policies.sql — Row Level Security
-- ============================================================

-- Activar RLS en todas las tablas
ALTER TABLE tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_timeline     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_vehiculo  ENABLE ROW LEVEL SECURITY;

-- ── TENANTS ──────────────────────────────────────────────────
-- Solo platform_admin y dueños ven su tenant
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT TO authenticated
  USING (
    id = current_tenant_id()
    OR EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND is_platform_admin = TRUE)
  );

CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE TO authenticated
  USING (id = current_tenant_id() AND es_dueno_o_admin())
  WITH CHECK (id = current_tenant_id() AND es_dueno_o_admin());

-- Platform admin puede crear tenants
CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND is_platform_admin = TRUE)
  );

-- ── USUARIOS ─────────────────────────────────────────────────
-- Cada usuario ve su propio perfil + los del mismo tenant
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tenant_members tm
      WHERE tm.user_id  = usuarios.id
        AND tm.tenant_id = current_tenant_id()
        AND tm.activo   = TRUE
    )
    OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.is_platform_admin = TRUE)
  );

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Inserción vía trigger (handle_new_auth_user) usa SECURITY DEFINER → no necesita policy
-- Pero para el script de seed necesitamos esto:
CREATE POLICY "usuarios_insert_admin" ON usuarios
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND is_platform_admin = TRUE)
  );

-- ── EQUIPOS ───────────────────────────────────────────────────
CREATE POLICY "equipos_select" ON equipos
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

CREATE POLICY "equipos_insert" ON equipos
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND tiene_rol_o_mayor('gerente')
  );

CREATE POLICY "equipos_update" ON equipos
  FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND tiene_rol_o_mayor('gerente'))
  WITH CHECK (tenant_id = current_tenant_id() AND tiene_rol_o_mayor('gerente'));

-- ── TENANT MEMBERS ────────────────────────────────────────────
CREATE POLICY "tenant_members_select" ON tenant_members
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

CREATE POLICY "tenant_members_insert" ON tenant_members
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND tiene_rol_o_mayor('gerente')
  );

CREATE POLICY "tenant_members_update" ON tenant_members
  FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND tiene_rol_o_mayor('gerente'))
  WITH CHECK (tenant_id = current_tenant_id() AND tiene_rol_o_mayor('gerente'));

-- ── LEADS ─────────────────────────────────────────────────────

-- Helper inline: ¿puede este usuario ver este lead?
-- dueno/gerente: todos los leads del tenant
-- supervisor: leads de su equipo
-- vendedor: solo sus propios leads
CREATE POLICY "leads_select" ON leads
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
    AND (
      es_dueno_o_admin()
      OR rol_actual() = 'gerente'
      OR (
        rol_actual() = 'supervisor'
        AND equipo_id IN (
          SELECT id FROM equipos
          WHERE supervisor_id = auth.uid()
            AND tenant_id = current_tenant_id()
        )
      )
      OR (rol_actual() = 'vendedor' AND assigned_to = auth.uid())
      OR assigned_to IS NULL  -- Bandeja General: todos los activos la ven
    )
  );

CREATE POLICY "leads_insert" ON leads
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
    AND tiene_rol_o_mayor('supervisor')
  );

CREATE POLICY "leads_update" ON leads
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
    AND (
      es_dueno_o_admin()
      OR rol_actual() = 'gerente'
      OR (
        rol_actual() = 'supervisor'
        AND equipo_id IN (
          SELECT id FROM equipos
          WHERE supervisor_id = auth.uid()
            AND tenant_id = current_tenant_id()
        )
      )
      OR (rol_actual() = 'vendedor' AND assigned_to = auth.uid())
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

-- ── LEAD NOTES ────────────────────────────────────────────────
CREATE POLICY "lead_notes_select" ON lead_notes
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
    AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = lead_notes.lead_id
        AND (
          es_dueno_o_admin()
          OR rol_actual() = 'gerente'
          OR (rol_actual() = 'supervisor' AND l.equipo_id IN (
               SELECT id FROM equipos WHERE supervisor_id = auth.uid()
                 AND tenant_id = current_tenant_id()
             ))
          OR (rol_actual() = 'vendedor' AND l.assigned_to = auth.uid())
        )
    )
  );

CREATE POLICY "lead_notes_insert" ON lead_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

-- ── LEAD TIMELINE ─────────────────────────────────────────────
CREATE POLICY "lead_timeline_select" ON lead_timeline
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

CREATE POLICY "lead_timeline_insert" ON lead_timeline
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

-- ── LEAD TASKS ────────────────────────────────────────────────
CREATE POLICY "lead_tasks_select" ON lead_tasks
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

CREATE POLICY "lead_tasks_insert" ON lead_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

CREATE POLICY "lead_tasks_update" ON lead_tasks
  FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND es_usuario_activo())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── MODELOS VEHICULO ──────────────────────────────────────────
CREATE POLICY "modelos_vehiculo_select" ON modelos_vehiculo
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

CREATE POLICY "modelos_vehiculo_write" ON modelos_vehiculo
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND es_dueno_o_admin())
  WITH CHECK (tenant_id = current_tenant_id() AND es_dueno_o_admin());
