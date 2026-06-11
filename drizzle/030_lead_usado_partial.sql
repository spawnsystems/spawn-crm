-- Campos parciales del usado anotados al crear el lead (antes de cotizar).
-- Permiten cargar TODO lo que se sepa del auto en el alta (marca/año obligatorios;
-- km, uso y valor InfoAuto opcionales) y, si alcanza para calcular, generar la
-- cotización automáticamente. Si no alcanza, quedan como borrador y pre-cargan
-- el cotizador desde la ficha del lead.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS usado_km integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS usado_uso text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS usado_valor_infoauto numeric(14,2);

-- Backfill desde la última cotización por lead, para que los usados ya cargados
-- pre-llenen el cotizador con sus datos reales si se quisieran re-cotizar.
UPDATE leads l
SET usado_km = (
  SELECT c.km FROM cotizaciones c
  WHERE c.lead_id = l.id AND c.km IS NOT NULL ORDER BY c.created_at DESC LIMIT 1
)
WHERE l.tiene_usado = true AND l.usado_km IS NULL;

UPDATE leads l
SET usado_uso = (
  SELECT c.uso FROM cotizaciones c
  WHERE c.lead_id = l.id AND c.uso IS NOT NULL ORDER BY c.created_at DESC LIMIT 1
)
WHERE l.tiene_usado = true AND l.usado_uso IS NULL;

UPDATE leads l
SET usado_valor_infoauto = (
  SELECT c.base_infoauto FROM cotizaciones c
  WHERE c.lead_id = l.id AND c.base_infoauto IS NOT NULL ORDER BY c.created_at DESC LIMIT 1
)
WHERE l.tiene_usado = true AND l.usado_valor_infoauto IS NULL;
