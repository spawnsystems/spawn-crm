-- Llamadas coordinadas vinculadas a leads.
-- No se muestran en el calendario; viven exclusivamente en el detalle del lead.

CREATE TABLE lead_calls (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  lead_id         uuid        NOT NULL REFERENCES leads(id)     ON DELETE CASCADE,
  created_by      uuid                 REFERENCES usuarios(id)  ON DELETE SET NULL,
  scheduled_at    timestamptz NOT NULL,
  notas_previas   text,
  -- Post-llamada (NULL mientras esté pendiente)
  realizada_at    timestamptz,
  outcome         text,           -- 'proxima_llamada' | 'cita' | 'descartado'
  notas_resultado text,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_calls_lead   ON lead_calls (lead_id);
CREATE INDEX idx_lead_calls_tenant ON lead_calls (tenant_id, scheduled_at DESC);

ALTER TABLE lead_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_scope_lead_calls" ON lead_calls
  FOR ALL
  USING  (tenant_id = current_tenant_id() AND es_usuario_activo())
  WITH CHECK (tenant_id = current_tenant_id() AND es_usuario_activo());
