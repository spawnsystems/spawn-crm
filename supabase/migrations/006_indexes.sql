-- ============================================================
-- 006_indexes.sql — Índices de performance
-- ============================================================

-- Leads: los más consultados
CREATE INDEX idx_leads_tenant_assigned  ON leads (tenant_id, assigned_to);
CREATE INDEX idx_leads_tenant_status    ON leads (tenant_id, status);
CREATE INDEX idx_leads_tenant_equipo    ON leads (tenant_id, equipo_id);
CREATE INDEX idx_leads_abandoned        ON leads (tenant_id, abandoned_at)
  WHERE abandoned_at IS NOT NULL;
CREATE INDEX idx_leads_at_risk          ON leads (tenant_id, at_risk)
  WHERE at_risk = TRUE;

-- Timeline: siempre se consulta por lead_id ordenado por fecha
CREATE INDEX idx_lead_timeline_lead     ON lead_timeline (lead_id, created_at DESC);

-- Notes y tasks por lead
CREATE INDEX idx_lead_notes_lead        ON lead_notes (lead_id, created_at DESC);
CREATE INDEX idx_lead_tasks_lead        ON lead_tasks (lead_id, done);
CREATE INDEX idx_lead_tasks_assigned    ON lead_tasks (assigned_to, done);

-- Membresías: lookup de tenant por usuario (frecuente en cada request)
CREATE INDEX idx_tenant_members_user    ON tenant_members (user_id, activo);
CREATE INDEX idx_tenant_members_tenant  ON tenant_members (tenant_id, activo);

-- Equipos por tenant
CREATE INDEX idx_equipos_tenant         ON equipos (tenant_id, activo);
CREATE INDEX idx_equipos_gerente        ON equipos (gerente_id);
CREATE INDEX idx_equipos_supervisor     ON equipos (supervisor_id);

-- Vehículos por tenant
CREATE INDEX idx_modelos_tenant         ON modelos_vehiculo (tenant_id);
