-- Reemplazar modelos existentes por los 8 modelos oficiales.
-- 1) Borra todos los modelos que NO estén en la lista.
-- 2) Inserta los que faltan; activa los que ya existan.
-- Ejecutar en el SQL Editor de Supabase.

DO $$
DECLARE
  t_id   uuid;
  modelo text;
  modelos text[] := ARRAY[
    'TRACKER 1.2T LT AT',
    'ONIX 1.0T LT MT',
    'MONTANA 1.2 T LT AT',
    'CAPTIVA PHEV',
    'SONIC 1.0T PREMIER AT',
    'S10 CD 2.8 TD 4X2 WT',
    'ONIX PLUS 1.0T LT MT',
    'SPIN 1.8'
  ];
BEGIN
  -- Paso 1: eliminar modelos que no están en la lista oficial
  DELETE FROM modelos_vehiculo
  WHERE nombre != ALL(modelos);

  -- Paso 2: para cada tenant, insertar/activar cada modelo oficial
  FOR t_id IN SELECT id FROM tenants LOOP
    FOREACH modelo IN ARRAY modelos LOOP
      UPDATE modelos_vehiculo
        SET activo = true
        WHERE tenant_id = t_id AND nombre = modelo;

      IF NOT FOUND THEN
        INSERT INTO modelos_vehiculo (tenant_id, nombre, activo)
        VALUES (t_id, modelo, true);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Verificar resultado
SELECT tenant_id, nombre, activo
FROM modelos_vehiculo
ORDER BY tenant_id, nombre;
