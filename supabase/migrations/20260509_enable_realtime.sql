-- ── 20260509_enable_realtime.sql ─────────────────────────────────────────────
-- Adds tables to the supabase_realtime publication so that
-- postgres_changes subscriptions in the app receive live events.
--
-- Tables already in the publication (e.g. cronograma_atividades) are skipped
-- automatically — ADD TABLE is idempotent when wrapped in a DO block.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'despesas',
    'vendas',
    'estoque_insumos',
    'estoque_movimentos',
    'plantios'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Only add if the table is not already in the publication
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_publication_tables
      WHERE  pubname   = 'supabase_realtime'
        AND  schemaname = 'public'
        AND  tablename  = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END;
$$;
