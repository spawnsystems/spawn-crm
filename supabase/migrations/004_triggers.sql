-- ============================================================
-- 004_triggers.sql — Triggers automáticos
-- ============================================================

-- ── updated_at automático ─────────────────────────────────────
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_equipos_updated_at
  BEFORE UPDATE ON equipos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tenant_members_updated_at
  BEFORE UPDATE ON tenant_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_modelos_vehiculo_updated_at
  BEFORE UPDATE ON modelos_vehiculo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── stage_entered_at reset al cambiar status ──────────────────
CREATE OR REPLACE FUNCTION reset_stage_entered_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    NEW.stage_entered_at := NOW();
    NEW.days_in_stage    := 0;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_stage_reset
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION reset_stage_entered_at();

-- ── days_in_stage recalculado en UPDATE ───────────────────────
CREATE OR REPLACE FUNCTION update_days_in_stage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.days_in_stage := GREATEST(0,
    EXTRACT(DAY FROM (NOW() - NEW.stage_entered_at))::INTEGER
  );
  RETURN NEW;
END;
$$;

-- Nota: Se ejecuta DESPUÉS del reset de stage para no pisarlo
CREATE TRIGGER trg_leads_days_in_stage
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_days_in_stage();

-- ── at_risk: TRUE si lleva > 24h sin contacto ─────────────────
CREATE OR REPLACE FUNCTION update_at_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.last_contact_at IS NULL THEN
    -- Si nunca se contactó, en riesgo si el lead tiene > 24h
    NEW.at_risk := (NOW() - NEW.created_at) > INTERVAL '24 hours';
  ELSE
    NEW.at_risk := (NOW() - NEW.last_contact_at) > INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_at_risk
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_at_risk();

-- ── abandoned_at + rescue_category ───────────────────────────
-- Se marca como abandonado si pasan 15 días sin actividad
-- y el status no es Cerrado ni Perdido.
CREATE OR REPLACE FUNCTION update_abandoned()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Limpiar si se volvió a contactar o cambió de estado activo
  IF NEW.last_contact_at IS NOT NULL
     AND NEW.last_contact_at > (NOW() - INTERVAL '15 days')
  THEN
    NEW.abandoned_at     := NULL;
    NEW.rescue_category  := NULL;
    RETURN NEW;
  END IF;

  -- No marcar como abandonado si ya está cerrado/perdido
  IF NEW.status IN ('Cerrado', 'Perdido') THEN
    RETURN NEW;
  END IF;

  -- Marcar abandonado si supera 15 días sin contacto
  IF (NEW.last_contact_at IS NULL AND (NOW() - NEW.created_at) > INTERVAL '15 days')
  OR (NEW.last_contact_at IS NOT NULL AND (NOW() - NEW.last_contact_at) > INTERVAL '15 days')
  THEN
    NEW.abandoned_at := COALESCE(NEW.abandoned_at, NOW());

    -- Categoría de rescate según el último status
    NEW.rescue_category := CASE NEW.status
      WHEN 'Cotizado'    THEN 'cotizado_sin_respuesta'::rescue_category
      WHEN 'Test drive'  THEN 'no_se_presento'::rescue_category
      WHEN 'Negociación' THEN 'negociacion_abandonada'::rescue_category
      ELSE NULL
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_abandoned
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_abandoned();

-- ── Sincronizar usuario en auth trigger ──────────────────────
-- Cuando Supabase crea un usuario en auth.users, lo insertamos en public.usuarios
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, rol, is_platform_admin, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'rol')::app_role, 'vendedor'),
    COALESCE((NEW.raw_user_meta_data->>'is_platform_admin')::boolean, FALSE),
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email  = EXCLUDED.email,
    nombre = EXCLUDED.nombre;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
