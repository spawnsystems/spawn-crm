-- ============================================================
-- 008_tenant_modules.sql
-- Módulos configurables por tenant + bucket para logos
-- ============================================================

-- ── Enum de módulos ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE module_key AS ENUM (
    'pipeline',
    'rescate',
    'test_drive',
    'cotizaciones',
    'inventario',
    'reportes'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tabla tenant_modules ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_key  module_key NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tenant_modules_tenant_module_uq UNIQUE (tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON tenant_modules (tenant_id);

-- ── Seed: activar módulos default (pipeline + rescate) para tenants existentes ──
INSERT INTO tenant_modules (tenant_id, module_key, enabled)
SELECT id, 'pipeline', TRUE FROM tenants
ON CONFLICT (tenant_id, module_key) DO NOTHING;

INSERT INTO tenant_modules (tenant_id, module_key, enabled)
SELECT id, 'rescate', TRUE FROM tenants
ON CONFLICT (tenant_id, module_key) DO NOTHING;
