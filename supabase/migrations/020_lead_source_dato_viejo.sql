-- Agrega el valor 'Dato viejo' al enum lead_source.
-- ALTER TYPE ... ADD VALUE es transaccional en Postgres 12+
-- y no requiere swap de tipo porque no hay columnas CHECK dependientes.

ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'Dato viejo';
