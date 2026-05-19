-- ============================================================
-- 001_enums.sql — Tipos enumerados
-- ============================================================

CREATE TYPE app_role AS ENUM (
  'platform_admin',
  'dueno',
  'gerente',
  'supervisor',
  'vendedor'
);

CREATE TYPE lead_status AS ENUM (
  'Nuevo',
  'Contactado',
  'Cotizado',
  'Test drive',
  'Negociación',
  'Cerrado',
  'Perdido'
);

CREATE TYPE lead_source AS ENUM (
  'Meta Ads',
  'Mercado Libre',
  'Web',
  'Referido',
  'Walk-in',
  'Otro'
);

CREATE TYPE team_role AS ENUM (
  'gerente',
  'supervisor',
  'vendedor'
);

CREATE TYPE rescue_category AS ENUM (
  'cotizado_sin_respuesta',
  'no_se_presento',
  'negociacion_abandonada'
);

CREATE TYPE invitation_status AS ENUM (
  'pending',
  'accepted',
  'expired'
);
