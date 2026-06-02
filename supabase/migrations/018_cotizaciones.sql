-- ============================================================
-- 018_cotizaciones.sql — Cotizador de usados + registro de ventas
-- ============================================================

BEGIN;

-- Tipo de uso del vehículo (afecta los descuentos)
CREATE TYPE usado_uso AS ENUM ('particular', 'taxi_uber_transporte');

-- Tabla de cotizaciones de usados (vinculadas a un lead)
CREATE TABLE cotizaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,

  -- Datos del vehículo usado
  marca_modelo     text,
  anio             integer,
  km               integer,
  uso              usado_uso NOT NULL DEFAULT 'particular',

  -- Cálculo InfoAuto
  base_infoauto    numeric(14,2) NOT NULL,    -- valor base ingresado por el vendedor
  descuento_pct    numeric(5,2),              -- porcentaje de descuento aplicado
  valor_calculado  numeric(14,2),             -- base * (1 - pct/100)
  override_valor   numeric(14,2),             -- "figurita" manual del vendedor
  valor_final      numeric(14,2) NOT NULL,    -- override ?? valor_calculado

  -- Estado
  rechazado        boolean NOT NULL DEFAULT false,
  rechazo_motivo   text,
  condiciones      text,                      -- texto de condiciones comerciales mostrado

  -- Auditoría
  created_by  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cotizaciones_tenant_created ON cotizaciones (tenant_id, created_at DESC);
CREATE INDEX idx_cotizaciones_lead           ON cotizaciones (lead_id);

-- Registro de ventas cerradas
CREATE TABLE registro_ventas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  vendedor_id     uuid REFERENCES usuarios(id) ON DELETE SET NULL,

  modelo          text,
  monto           numeric(14,2),
  usado_tomado_id uuid REFERENCES cotizaciones(id) ON DELETE SET NULL,

  vendida_at      timestamptz NOT NULL DEFAULT NOW(),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ventas_tenant_vendida ON registro_ventas (tenant_id, vendida_at DESC);
CREATE INDEX idx_ventas_vendedor       ON registro_ventas (vendedor_id);

-- RLS — misma estructura que leads
ALTER TABLE cotizaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE registro_ventas ENABLE ROW LEVEL SECURITY;

-- Vendedor ve las cotizaciones de sus leads; supervisor/gerente por equipo; dueño todo
CREATE POLICY "tenant_cotizaciones" ON cotizaciones
  FOR ALL USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

CREATE POLICY "tenant_ventas" ON registro_ventas
  FOR ALL USING (
    tenant_id = current_tenant_id()
    AND es_usuario_activo()
  );

COMMIT;
