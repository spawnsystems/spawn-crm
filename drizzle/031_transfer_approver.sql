-- ============================================================
-- 031_transfer_approver.sql
-- Traspasos: ahora los aprueba el supervisor del equipo (no el receptor).
-- Agrega approver_id para saber quién debe aprobar/rechazar cada traspaso.
-- ============================================================

BEGIN;

-- Quién debe aprobar el traspaso. Se resuelve al crearlo con la precedencia
-- supervisor del equipo → gerente del equipo → dueño del tenant.
-- Nullable porque los traspasos viejos (flujo receptor) no lo tienen.
ALTER TABLE lead_transfers
  ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;

-- Para listar rápido los traspasos pendientes que un usuario debe aprobar.
CREATE INDEX IF NOT EXISTS idx_transfers_approver
  ON lead_transfers (approver_id, created_at DESC);

COMMIT;
