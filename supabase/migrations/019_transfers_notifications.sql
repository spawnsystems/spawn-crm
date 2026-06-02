-- ============================================================
-- 019_transfers_notifications.sql
-- Traspasos de leads con aprobación + notificaciones in-app
-- ============================================================

BEGIN;

-- ── Enum de estado del traspaso ───────────────────────────────────────────────

CREATE TYPE transfer_status AS ENUM (
  'pendiente',   -- esperando respuesta del receptor
  'aceptada',    -- lead reasignado al receptor
  'rechazada',   -- receptor rechazó
  'cancelada'    -- solicitante canceló antes de respuesta
);

-- ── Tabla de traspasos ────────────────────────────────────────────────────────

CREATE TABLE lead_transfers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id      uuid NOT NULL REFERENCES leads(id)   ON DELETE CASCADE,

  from_user_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  to_user_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  status       transfer_status NOT NULL DEFAULT 'pendiente',
  motivo       text,
  responded_at timestamptz,

  created_at   timestamptz NOT NULL DEFAULT NOW()
);

-- Solo puede haber un traspaso pendiente por lead a la vez
CREATE UNIQUE INDEX idx_transfers_lead_pendiente
  ON lead_transfers (lead_id)
  WHERE status = 'pendiente';

CREATE INDEX idx_transfers_to_user ON lead_transfers (to_user_id, created_at DESC);
CREATE INDEX idx_transfers_tenant  ON lead_transfers (tenant_id,  created_at DESC);

-- ── Tabla de notificaciones ───────────────────────────────────────────────────

CREATE TABLE notifications (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES usuarios(id)  ON DELETE CASCADE,

  kind      text NOT NULL,   -- 'transfer_request' | 'transfer_accepted' | 'transfer_rejected'
  title     text NOT NULL,
  body      text,

  entity    text,            -- 'lead_transfer'
  entity_id uuid,

  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user   ON notifications (user_id,   read_at, created_at DESC);
CREATE INDEX idx_notifications_tenant ON notifications (tenant_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE lead_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;

-- Traspasos: cualquier usuario activo del tenant puede leer/escribir
-- (granulado a nivel de app: solo el from/to puede actuar)
CREATE POLICY "tenant_transfers" ON lead_transfers
  FOR ALL USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

-- Notificaciones: cada usuario solo ve las suyas
CREATE POLICY "own_notifications" ON notifications
  FOR ALL USING (
    tenant_id = current_tenant_id()
    AND user_id = auth.uid()
    AND es_usuario_activo()
  );

COMMIT;
