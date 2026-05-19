-- ============================================================
-- 002_tables.sql — Tablas en orden de dependencia
-- ============================================================

-- ── Tenants ──────────────────────────────────────────────────
CREATE TABLE tenants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  concesionaria    TEXT NOT NULL,
  logo_url         TEXT,
  color_primario   TEXT DEFAULT '#2563eb',
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  plan_key         TEXT NOT NULL DEFAULT 'starter',
  cotizacion_config JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Usuarios (espejo de auth.users) ──────────────────────────
CREATE TABLE usuarios (
  id                UUID PRIMARY KEY, -- = auth.users.id
  email             TEXT NOT NULL UNIQUE,
  nombre            TEXT NOT NULL,
  alias             TEXT,
  rol               app_role NOT NULL DEFAULT 'vendedor',
  is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Equipos ───────────────────────────────────────────────────
CREATE TABLE equipos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  gerente_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tenant Members ────────────────────────────────────────────
CREATE TABLE tenant_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol               app_role NOT NULL,
  equipo_id         UUID REFERENCES equipos(id) ON DELETE SET NULL,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  invitation_status invitation_status NOT NULL DEFAULT 'pending',
  invited_at        TIMESTAMPTZ DEFAULT NOW(),
  accepted_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

-- ── Leads ─────────────────────────────────────────────────────
CREATE TABLE leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Prospecto
  nombre                TEXT NOT NULL,
  telefono              TEXT,
  email                 TEXT,
  modelo                TEXT,
  source                lead_source NOT NULL DEFAULT 'Otro',

  -- Pipeline
  status                lead_status NOT NULL DEFAULT 'Nuevo',
  next_action           TEXT,
  est_value             NUMERIC(14,2),

  -- Tiempo y riesgo
  days_in_stage         INTEGER NOT NULL DEFAULT 0,
  at_risk               BOOLEAN NOT NULL DEFAULT FALSE,
  last_contact_at       TIMESTAMPTZ,
  last_contact_critical BOOLEAN NOT NULL DEFAULT FALSE,
  stage_entered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Rescate
  abandoned_at          TIMESTAMPTZ,
  rescue_category       rescue_category,

  -- Asignación
  assigned_to           UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  equipo_id             UUID REFERENCES equipos(id) ON DELETE SET NULL,

  -- Auditoría
  created_by            UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Lead Notes ────────────────────────────────────────────────
CREATE TABLE lead_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  texto      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Lead Timeline ─────────────────────────────────────────────
CREATE TABLE lead_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  actor_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Lead Tasks ────────────────────────────────────────────────
CREATE TABLE lead_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  texto       TEXT NOT NULL,
  due_at      TIMESTAMPTZ,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Modelos de Vehículo ───────────────────────────────────────
CREATE TABLE modelos_vehiculo (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  motor        TEXT,
  transmision  TEXT,
  consumo      TEXT,
  precio       NUMERIC(14,2),
  stock        INTEGER DEFAULT 0,
  colores      TEXT[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
