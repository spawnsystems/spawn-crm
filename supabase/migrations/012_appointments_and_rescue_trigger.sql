-- ============================================================
-- 012_appointments_and_rescue_trigger.sql
-- ─ Nuevo trigger update_abandoned: en vez de solo setear abandoned_at,
--   ahora también cambia status='Para rescate' (status explícito).
-- ─ Nueva tabla lead_appointments con índices, constraint de "una cita viva
--   por lead" y políticas RLS.
-- ============================================================

BEGIN;

-- ── 1. Reemplazar trigger de abandonment ─────────────────────

CREATE OR REPLACE FUNCTION update_abandoned()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si fue recontactado dentro de los 15 días, limpiar abandoned_at
  -- (el status 'Para rescate' se limpia en server actions, no acá,
  --  para no perder la trazabilidad sin querer)
  IF NEW.last_contact_at IS NOT NULL
     AND NEW.last_contact_at > (NOW() - INTERVAL '15 days')
  THEN
    NEW.abandoned_at := NULL;
    RETURN NEW;
  END IF;

  -- No marcar como abandonado si ya está en estado terminal positivo
  IF NEW.status = 'Cerrado' THEN
    RETURN NEW;
  END IF;

  -- Marcar abandonado si supera 15 días sin contacto
  IF (NEW.last_contact_at IS NULL  AND (NOW() - NEW.created_at)     > INTERVAL '15 days')
  OR (NEW.last_contact_at IS NOT NULL AND (NOW() - NEW.last_contact_at) > INTERVAL '15 days')
  THEN
    NEW.abandoned_at := COALESCE(NEW.abandoned_at, NOW());
    -- Cambiar status a 'Para rescate' (solo si no estaba ya)
    IF NEW.status <> 'Para rescate' THEN
      NEW.status := 'Para rescate'::lead_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_abandoned
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_abandoned();

-- ── 2. Enums de appointments ─────────────────────────────────

CREATE TYPE appointment_tipo AS ENUM (
  'test_drive',
  'visita_showroom',
  'videollamada',
  'entrega'
);

CREATE TYPE appointment_status AS ENUM (
  'programada',
  'realizada',
  'no_se_presento',
  'reagendada',
  'cancelada'
);

-- ── 3. Tabla lead_appointments ───────────────────────────────

CREATE TABLE lead_appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES leads(id)    ON DELETE CASCADE,
  vendedor_id     UUID REFERENCES usuarios(id)          ON DELETE SET NULL,
  equipo_id       UUID REFERENCES equipos(id)           ON DELETE SET NULL,

  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_min    INTEGER NOT NULL DEFAULT 60,
  tipo            appointment_tipo NOT NULL,
  lugar           TEXT,
  modelo_interes  TEXT,
  notas           TEXT,

  status          appointment_status NOT NULL DEFAULT 'programada',
  outcome_notes   TEXT,

  created_by      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_lead_appointments_updated_at
  BEFORE UPDATE ON lead_appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. Índices ───────────────────────────────────────────────

CREATE INDEX idx_appt_lead_scheduled
  ON lead_appointments (lead_id, scheduled_at DESC);

CREATE INDEX idx_appt_vendedor_scheduled
  ON lead_appointments (vendedor_id, scheduled_at);

CREATE INDEX idx_appt_equipo_scheduled
  ON lead_appointments (equipo_id, scheduled_at);

CREATE INDEX idx_appt_tenant_scheduled
  ON lead_appointments (tenant_id, scheduled_at);

-- Constraint clave: solo UNA cita viva ('programada') por lead.
CREATE UNIQUE INDEX uq_one_live_appt_per_lead
  ON lead_appointments (lead_id)
  WHERE status = 'programada';

-- ── 5. RLS ──────────────────────────────────────────────────

ALTER TABLE lead_appointments ENABLE ROW LEVEL SECURITY;

-- SELECT: misma lógica de scope que leads
CREATE POLICY "lead_appointments_select" ON lead_appointments
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
      OR (rol_actual() = 'vendedor' AND vendedor_id = auth.uid())
    )
  );

-- INSERT: cualquier usuario activo del tenant puede crear citas para leads
-- a los que tiene acceso (la validación de "lead accesible" la hace el server action)
CREATE POLICY "lead_appointments_insert" ON lead_appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

-- UPDATE: el dueño de la cita o quien pueda ver el lead
CREATE POLICY "lead_appointments_update" ON lead_appointments
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
      OR (rol_actual() = 'vendedor' AND vendedor_id = auth.uid())
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

-- DELETE: prohibido (usar cancelación lógica vía status='cancelada')

COMMIT;
