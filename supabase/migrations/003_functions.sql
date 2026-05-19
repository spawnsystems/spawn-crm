-- ============================================================
-- 003_functions.sql — Helper functions para RLS
-- ============================================================

-- Retorna el tenant_id activo para el usuario autenticado.
-- Si es platform_admin y tiene cookie de preview, retorna ese tenant.
-- De lo contrario retorna el tenant de su membresía activa.
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_admin  BOOLEAN;
  v_preview   TEXT;
BEGIN
  -- Ver si es platform_admin
  SELECT is_platform_admin INTO v_is_admin
  FROM usuarios
  WHERE id = auth.uid();

  -- Si es admin y tiene cookie de preview, usarla
  IF v_is_admin THEN
    v_preview := current_setting('app.preview_tenant_id', TRUE);
    IF v_preview IS NOT NULL AND v_preview <> '' THEN
      RETURN v_preview::UUID;
    END IF;
  END IF;

  -- Membresía activa normal
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_members
  WHERE user_id = auth.uid()
    AND activo = TRUE
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$;

-- Verifica que el usuario actual esté activo en su tenant
CREATE OR REPLACE FUNCTION es_usuario_activo()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tenant_members
    WHERE user_id  = auth.uid()
      AND tenant_id = current_tenant_id()
      AND activo   = TRUE
  );
END;
$$;

-- Retorna el rol del usuario en el tenant actual
CREATE OR REPLACE FUNCTION rol_actual()
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_rol app_role;
BEGIN
  SELECT rol INTO v_rol
  FROM tenant_members
  WHERE user_id   = auth.uid()
    AND tenant_id = current_tenant_id()
    AND activo    = TRUE
  LIMIT 1;
  RETURN v_rol;
END;
$$;

-- Verdadero si el usuario es dueño del tenant o platform_admin
CREATE OR REPLACE FUNCTION es_dueno_o_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_platform_admin INTO v_is_admin
  FROM usuarios WHERE id = auth.uid();

  IF v_is_admin THEN RETURN TRUE; END IF;

  RETURN rol_actual() IN ('dueno');
END;
$$;

-- Verdadero si el usuario tiene el rol indicado o superior en la jerarquía
-- Jerarquía: platform_admin > dueno > gerente > supervisor > vendedor
CREATE OR REPLACE FUNCTION tiene_rol_o_mayor(p_rol app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_rol  app_role;
  v_rank INT;
  p_rank INT;
BEGIN
  SELECT is_platform_admin INTO v_rank FROM usuarios WHERE id = auth.uid();
  IF v_rank = 1 THEN RETURN TRUE; END IF;

  v_rol := rol_actual();

  -- Mapeamos cada rol a un número: mayor = más permiso
  p_rank := CASE p_rol
    WHEN 'platform_admin' THEN 5
    WHEN 'dueno'          THEN 4
    WHEN 'gerente'        THEN 3
    WHEN 'supervisor'     THEN 2
    WHEN 'vendedor'       THEN 1
    ELSE 0
  END;

  v_rank := CASE v_rol
    WHEN 'platform_admin' THEN 5
    WHEN 'dueno'          THEN 4
    WHEN 'gerente'        THEN 3
    WHEN 'supervisor'     THEN 2
    WHEN 'vendedor'       THEN 1
    ELSE 0
  END;

  RETURN v_rank >= p_rank;
END;
$$;

-- Auto-update de updated_at en cualquier tabla
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
