-- ── 20260606_audit_log_table.sql ─────────────────────────────────────────────
-- CRITICAL FIX. The audit triggers (tg_audit_row) were attached to despesas,
-- plantios, receitas and vendas, but the public.audit_log table they INSERT into
-- did not exist in the database. Every INSERT/UPDATE/DELETE on those four tables
-- therefore failed with:
--     ERROR: 42P01: relation "public.audit_log" does not exist
--
-- Symptoms this caused:
--   • Despesas could not be saved (insert rejected, error swallowed).
--   • Receitas / vendas could not be saved.
--   • Perennial (talhão) lotes could not be created (nova safra), edited or deleted.
--
-- This migration (re)creates the audit_log table plus the trigger function and
-- the four triggers, idempotently, so a fresh database rebuild is consistent
-- with production.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. audit_log table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid,
  tabela       text NOT NULL,
  registro_id  uuid,
  acao         text NOT NULL,
  diff         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit entries. Inserts happen only via the
-- SECURITY DEFINER trigger function, which bypasses RLS — so no INSERT policy
-- is required (and none is granted, to keep the log tamper-resistant).
DROP POLICY IF EXISTS audit_log_owner_select ON public.audit_log;
CREATE POLICY audit_log_owner_select ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id          ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela_registro  ON public.audit_log(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at        ON public.audit_log(created_at DESC);

-- ── 2. Trigger function ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action text;
  v_diff   jsonb;
  v_user   uuid;
  v_reg_id uuid;
BEGIN
  v_user := auth.uid();

  IF (TG_OP = 'INSERT') THEN
    v_action := 'INSERT';
    v_diff   := to_jsonb(NEW);
    v_reg_id := NEW.id;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      v_action := 'SOFT_DELETE';
    ELSIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN
      v_action := 'RESTORE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_diff := (
      SELECT jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
      FROM jsonb_each(to_jsonb(OLD)) o
      JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
      WHERE o.value IS DISTINCT FROM n.value
    );
    v_reg_id := NEW.id;
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := 'DELETE';
    v_diff   := to_jsonb(OLD);
    v_reg_id := OLD.id;
  END IF;

  INSERT INTO public.audit_log (user_id, tabela, registro_id, acao, diff)
  VALUES (
    COALESCE(
      (CASE TG_OP WHEN 'DELETE' THEN (to_jsonb(OLD)->>'user_id')::uuid
                  ELSE             (to_jsonb(NEW)->>'user_id')::uuid END),
      v_user
    ),
    TG_TABLE_NAME,
    v_reg_id,
    v_action,
    v_diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ── 3. Triggers on the four audited tables ───────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_despesas ON public.despesas;
CREATE TRIGGER trg_audit_despesas
  AFTER INSERT OR UPDATE OR DELETE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

DROP TRIGGER IF EXISTS trg_audit_plantios ON public.plantios;
CREATE TRIGGER trg_audit_plantios
  AFTER INSERT OR UPDATE OR DELETE ON public.plantios
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

DROP TRIGGER IF EXISTS trg_audit_receitas ON public.receitas;
CREATE TRIGGER trg_audit_receitas
  AFTER INSERT OR UPDATE OR DELETE ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

DROP TRIGGER IF EXISTS trg_audit_vendas ON public.vendas;
CREATE TRIGGER trg_audit_vendas
  AFTER INSERT OR UPDATE OR DELETE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
