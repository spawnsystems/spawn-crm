-- Año del auto usado anotado al crear el lead (junto con la marca).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS usado_anio integer;

-- Retrocompatibilidad: copiar el año desde la cotización más reciente.
UPDATE leads l
SET usado_anio = (
  SELECT c.anio
  FROM cotizaciones c
  WHERE c.lead_id = l.id
    AND c.anio IS NOT NULL
  ORDER BY c.created_at DESC
  LIMIT 1
)
WHERE l.tiene_usado = true
  AND l.usado_anio IS NULL;
