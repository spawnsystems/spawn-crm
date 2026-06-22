-- ════════════════════════════════════════════════════════════════════════════
-- Corrección de horarios en el HISTORIAL de llamadas (bug de timezone)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Contexto: los eventos de historial 'call_scheduled' guardaron su texto con la
-- hora +3 (formateada en UTC en vez de en horario de Buenos Aires). El INSTANTE
-- real de la llamada (lead_calls.scheduled_at) está bien guardado; lo único mal
-- es el STRING congelado del timeline. Este script lo reescribe re-derivándolo
-- de la hora real, formateada en horario argentino.
--
-- Es SEGURO e IDEMPOTENTE:
--   • Solo toca filas cuyo título coincide EXACTAMENTE con el formato viejo (UTC).
--     Si ya está bien (o no matchea), no la toca.
--   • Re-derivar de scheduled_at evita parsear el texto viejo.
--   • Correrlo dos veces no cambia nada la segunda vez.
--
-- Cubre los 3 textos que genera el sistema:
--   "Llamada agendada para el <fecha>"
--   "Próxima llamada agendada: <fecha>"
--   "Reintento de llamada agendado: <fecha>"
-- (Las CITAS ya se guardaban en hora BA — no se tocan.)
--
-- ── PASO 1 (opcional): previsualizar qué va a cambiar ────────────────────────
-- Descomentá y corré este SELECT primero para ver el antes/después sin escribir:
--
-- WITH meses(n, abbr) AS (VALUES
--   (1,'ene'),(2,'feb'),(3,'mar'),(4,'abr'),(5,'may'),(6,'jun'),
--   (7,'jul'),(8,'ago'),(9,'sep'),(10,'oct'),(11,'nov'),(12,'dic')),
-- cand AS (
--   SELECT t.id, t.title,
--     CASE
--       WHEN t.title LIKE 'Llamada agendada para el %'      THEN 'Llamada agendada para el '
--       WHEN t.title LIKE 'Próxima llamada agendada: %'      THEN 'Próxima llamada agendada: '
--       WHEN t.title LIKE 'Reintento de llamada agendado: %' THEN 'Reintento de llamada agendado: '
--     END AS prefix, c.scheduled_at
--   FROM lead_timeline t
--   JOIN LATERAL (
--     SELECT lc.scheduled_at FROM lead_calls lc
--     WHERE lc.tenant_id = t.tenant_id AND lc.lead_id = t.lead_id
--       AND lc.created_at BETWEEN t.created_at - interval '2 minutes' AND t.created_at + interval '30 seconds'
--     ORDER BY abs(extract(epoch FROM (lc.created_at - t.created_at))) LIMIT 1
--   ) c ON true
--   WHERE t.event_type = 'call_scheduled')
-- SELECT cand.title AS antes,
--   cand.prefix
--     || (extract(day FROM ba.ts)::int || ' de ' || mba.abbr || ' a las ' || to_char(ba.ts,'HH24:MI')) AS despues
-- FROM cand
-- CROSS JOIN LATERAL (SELECT (cand.scheduled_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS ts) ba
-- CROSS JOIN LATERAL (SELECT (cand.scheduled_at AT TIME ZONE 'UTC') AS ts) ut
-- JOIN meses mba ON mba.n = extract(month FROM ba.ts)::int
-- JOIN meses mut ON mut.n = extract(month FROM ut.ts)::int
-- WHERE cand.prefix IS NOT NULL
--   AND cand.title = cand.prefix || (extract(day FROM ut.ts)::int || ' de ' || mut.abbr || ' a las ' || to_char(ut.ts,'HH24:MI'));

-- ── PASO 2: aplicar la corrección ────────────────────────────────────────────
BEGIN;

WITH meses(n, abbr) AS (VALUES
  (1,'ene'),(2,'feb'),(3,'mar'),(4,'abr'),(5,'may'),(6,'jun'),
  (7,'jul'),(8,'ago'),(9,'sep'),(10,'oct'),(11,'nov'),(12,'dic')
),
candidatos AS (
  SELECT
    t.id AS timeline_id,
    t.title,
    CASE
      WHEN t.title LIKE 'Llamada agendada para el %'      THEN 'Llamada agendada para el '
      WHEN t.title LIKE 'Próxima llamada agendada: %'      THEN 'Próxima llamada agendada: '
      WHEN t.title LIKE 'Reintento de llamada agendado: %' THEN 'Reintento de llamada agendado: '
    END AS prefix,
    c.scheduled_at
  FROM lead_timeline t
  JOIN LATERAL (
    -- La llamada se inserta junto con el evento de historial (mismo action),
    -- así que matcheamos por la creada más cerca en el tiempo.
    SELECT lc.scheduled_at
    FROM lead_calls lc
    WHERE lc.tenant_id = t.tenant_id
      AND lc.lead_id   = t.lead_id
      AND lc.created_at BETWEEN t.created_at - interval '2 minutes'
                            AND t.created_at + interval '30 seconds'
    ORDER BY abs(extract(epoch FROM (lc.created_at - t.created_at)))
    LIMIT 1
  ) c ON true
  WHERE t.event_type = 'call_scheduled'
),
labeled AS (
  SELECT
    cand.timeline_id,
    cand.prefix,
    -- formato BA (correcto) — igual a date-fns "d 'de' MMM 'a las' HH:mm"
    (extract(day FROM ba.ts)::int || ' de ' || mba.abbr || ' a las ' || to_char(ba.ts, 'HH24:MI')) AS ba_label,
    -- formato UTC (el que dejó el bug)
    (extract(day FROM ut.ts)::int || ' de ' || mut.abbr || ' a las ' || to_char(ut.ts, 'HH24:MI')) AS utc_label
  FROM candidatos cand
  CROSS JOIN LATERAL (SELECT (cand.scheduled_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS ts) ba
  CROSS JOIN LATERAL (SELECT (cand.scheduled_at AT TIME ZONE 'UTC') AS ts) ut
  JOIN meses mba ON mba.n = extract(month FROM ba.ts)::int
  JOIN meses mut ON mut.n = extract(month FROM ut.ts)::int
  WHERE cand.prefix IS NOT NULL
)
UPDATE lead_timeline tl
SET title = l.prefix || l.ba_label
FROM labeled l
WHERE tl.id = l.timeline_id
  AND l.ba_label <> l.utc_label                 -- solo si la hora realmente cambia
  AND tl.title   = l.prefix || l.utc_label;     -- self-validation: matchea el texto viejo exacto

-- Verificá el número de filas corregidas en la salida (UPDATE N).
COMMIT;
