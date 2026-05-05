-- ── 20260505_sync_fixes.sql ────────────────────────────────────────────────
-- 1. Add missing updated_at column to venda_parcelas
-- 2. Ensure cronograma_atividades has the right indexes for Supabase sync

ALTER TABLE venda_parcelas
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'venda_parcelas_updated_at'
  ) THEN
    CREATE TRIGGER venda_parcelas_updated_at
      BEFORE UPDATE ON venda_parcelas
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- Index for fast cronograma_atividades lookups by plantio_id (used in sync load)
CREATE INDEX IF NOT EXISTS idx_cronograma_atividades_plantio
  ON cronograma_atividades(plantio_id);

-- Index for custom-only rows
CREATE INDEX IF NOT EXISTS idx_cronograma_atividades_custom
  ON cronograma_atividades(plantio_id, is_custom)
  WHERE is_custom = true;
