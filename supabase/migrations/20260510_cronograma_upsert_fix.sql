-- ── 20260510_cronograma_upsert_fix.sql ────────────────────────────────────────
-- Fixes the multi-device sync bug where marking a step as done was silently
-- failing because syncCronogramaStatus() had no unique constraint to resolve
-- upsert conflicts on, causing each mark/undo to INSERT a new row instead of
-- UPDATE — and an undefined `dia_previsto` (NOT NULL) caused inserts to fail.
--
-- Changes:
-- 1. Set is_custom NOT NULL DEFAULT false (was nullable → breaks UNIQUE logic)
-- 2. Add UNIQUE(plantio_id, etapa, is_custom) so upsert with onConflict works
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Coerce nulls, then harden is_custom ─────────────────────────────────
UPDATE public.cronograma_atividades
   SET is_custom = false
 WHERE is_custom IS NULL;

ALTER TABLE public.cronograma_atividades
  ALTER COLUMN is_custom SET DEFAULT false,
  ALTER COLUMN is_custom SET NOT NULL;

-- ── 2. Drop any leftover duplicate rows before adding unique constraint ──────
-- Keep the row with the most recent updated_at for each (plantio_id, etapa, is_custom).
DELETE FROM public.cronograma_atividades a
 USING public.cronograma_atividades b
 WHERE a.plantio_id = b.plantio_id
   AND a.etapa      = b.etapa
   AND a.is_custom  = b.is_custom
   AND a.id         < b.id;   -- keep the row with the higher UUID (last inserted)

-- ── 3. Add unique constraint ──────────────────────────────────────────────────
ALTER TABLE public.cronograma_atividades
  DROP CONSTRAINT IF EXISTS uq_cronograma_plantio_etapa_custom;

ALTER TABLE public.cronograma_atividades
  ADD CONSTRAINT uq_cronograma_plantio_etapa_custom
  UNIQUE (plantio_id, etapa, is_custom);
