-- ── 20260606_cronograma_status_removida.sql ──────────────────────────────────
-- Fixes the bug where deleting (removing) a cronograma step did not persist:
-- the step reappeared after a page refresh.
--
-- Root cause: removeStep() in CronogramaTimeline writes status='removida' via
-- syncCronogramaStatus(). The status CHECK constraint only allowed
-- ('pendente','feito','atrasado','ignorado'), so every removal was rejected by
-- the DB (error 23514) and silently swallowed by logDbError. No 'removida' row
-- was ever created, so on reload the base step rebuilt from cultura.cronograma
-- and reappeared.
--
-- Fix: add 'removida' to the allowed status values.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cronograma_atividades
  DROP CONSTRAINT IF EXISTS cronograma_atividades_status_check;

ALTER TABLE public.cronograma_atividades
  ADD CONSTRAINT cronograma_atividades_status_check
  CHECK (status = ANY (ARRAY[
    'pendente'::text,
    'feito'::text,
    'atrasado'::text,
    'ignorado'::text,
    'removida'::text
  ]));
