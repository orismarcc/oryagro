-- ── 20260606_plantios_status_concluido.sql ───────────────────────────────────
-- Fixes the bug where concluding a lote/safra did not persist.
--
-- LotePage.handleConcluir() calls updateLoteStatus(id, 'concluido'), but the
-- plantios_status_check constraint only allowed
-- ('ativo','colhido','perdido','cancelado'). The UPDATE was rejected (error
-- 23514) and swallowed, so the lote stayed 'ativo'. On reload it appeared
-- un-concluded. loadTalhoesPorPropriedade() and AnalysePage already read
-- 'concluido'/'arquivado', so the vocabulary was inconsistent with the DB.
--
-- Fix: allow 'concluido' and 'arquivado' (and keep NULL, the implicit default).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plantios
  DROP CONSTRAINT IF EXISTS plantios_status_check;

ALTER TABLE public.plantios
  ADD CONSTRAINT plantios_status_check
  CHECK (
    status IS NULL OR status = ANY (ARRAY[
      'ativo'::text,
      'colhido'::text,
      'concluido'::text,
      'arquivado'::text,
      'perdido'::text,
      'cancelado'::text
    ])
  );
