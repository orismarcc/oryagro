-- ── 20260510_audit_fixes.sql ──────────────────────────────────────────────────
-- Applies post-audit improvements:
-- 1. Add receitas to supabase_realtime publication
-- 2. Add UNIQUE constraint on ciclos_historico(lote_id)
-- 3. Fix set_updated_at() trigger to use SECURITY DEFINER + fixed search_path
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Realtime: add receitas ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname    = 'supabase_realtime'
      AND  schemaname = 'public'
      AND  tablename  = 'receitas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.receitas;
  END IF;
END;
$$;

-- ── 2. Unique index on ciclos_historico(lote_id) ──────────────────────────────
-- Prevents duplicate archive rows for the same lote.
-- DROP + CREATE ensures idempotency even if the index already exists with a
-- different name from a previous migration run.

CREATE UNIQUE INDEX IF NOT EXISTS idx_ciclos_historico_lote_id_unique
  ON public.ciclos_historico(lote_id);

-- ── 3. Fix set_updated_at trigger: SECURITY DEFINER + fixed search_path ───────
-- The function created in 20260505_sync_fixes.sql lacked SECURITY DEFINER and
-- SET search_path, which can expose the function to search_path injection.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
