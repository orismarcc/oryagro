-- ── 20260607_audit_actor.sql ─────────────────────────────────────────────────
-- Adiciona actor_id ao audit_log: QUEM realmente fez a alteração (auth.uid()),
-- separado de user_id (que é o DONO do registro). Essencial para a tela de
-- histórico no modo multi-usuário (ex.: "Técnico João alterou a despesa X").
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS actor_id uuid;

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
    v_action := 'INSERT'; v_diff := to_jsonb(NEW); v_reg_id := NEW.id;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN v_action := 'SOFT_DELETE';
    ELSIF (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL) THEN v_action := 'RESTORE';
    ELSE v_action := 'UPDATE'; END IF;
    v_diff := (SELECT jsonb_object_agg(key, jsonb_build_object('old', o.value, 'new', n.value))
      FROM jsonb_each(to_jsonb(OLD)) o JOIN jsonb_each(to_jsonb(NEW)) n USING (key)
      WHERE o.value IS DISTINCT FROM n.value);
    v_reg_id := NEW.id;
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := 'DELETE'; v_diff := to_jsonb(OLD); v_reg_id := OLD.id;
  END IF;

  INSERT INTO public.audit_log (user_id, actor_id, tabela, registro_id, acao, diff)
  VALUES (
    COALESCE((CASE TG_OP WHEN 'DELETE' THEN (to_jsonb(OLD)->>'user_id')::uuid
                         ELSE (to_jsonb(NEW)->>'user_id')::uuid END), v_user),
    v_user,
    TG_TABLE_NAME, v_reg_id, v_action, v_diff
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;
