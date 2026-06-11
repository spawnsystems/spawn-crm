-- Agrega columna para la marca del auto usado (anotada al crear el lead).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS usado_marca text;

-- Retrocompatibilidad: para leads que YA tienen cotizaciones, copiar la marca
-- de la cotización más reciente para que el card no quede en estado "Falta...".
UPDATE leads l
SET usado_marca = (
  SELECT c.marca_modelo
  FROM cotizaciones c
  WHERE c.lead_id = l.id
  ORDER BY c.created_at DESC
  LIMIT 1
)
WHERE l.tiene_usado = true
  AND l.usado_marca IS NULL;
