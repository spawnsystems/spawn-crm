-- Guarda la marca del auto usado informada al crear el lead,
-- antes de que se complete la cotización desde la ficha.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS usado_marca text;
