-- ── 20260525_audit_round4.sql ────────────────────────────────────────────────
-- Quarta rodada de auditoria — corrige problemas de integridade e modelagem:
--
-- 1. Vincular movimentos de estoque a despesas e a etapas do cronograma
--    para permitir reversão automática ao excluir despesa / desmarcar etapa.
-- 2. CHECK constraints em colunas numéricas críticas.
-- 3. NOT NULL em user_id de plantios e simulador_configs (com backfill seguro).
-- 4. Índice em estoque_movimentos(insumo_id) — antes era apenas FK implícito.
-- 5. RPC para deletar movimento e ajustar saldo atomicamente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Vincular movimentos a despesas e cronograma ───────────────────────────

ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS despesa_id uuid
    REFERENCES public.despesas(id) ON DELETE SET NULL;

ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS cronograma_atividade_id uuid
    REFERENCES public.cronograma_atividades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_despesa_id
  ON public.estoque_movimentos(despesa_id)
  WHERE despesa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_cronograma_atividade_id
  ON public.estoque_movimentos(cronograma_atividade_id)
  WHERE cronograma_atividade_id IS NOT NULL;

-- Índice em insumo_id — FK frequente sem índice próprio
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_insumo_id
  ON public.estoque_movimentos(insumo_id);

-- ── 2. CHECK constraints em colunas numéricas ────────────────────────────────
-- Adicionados via DO block + NOT VALID seguido de VALIDATE para tolerar
-- dados pré-existentes que possam violar a regra (são exibidos como warning).

DO $$
BEGIN
  -- estoque_insumos.quantidade >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estoque_insumos_quantidade_nonneg'
  ) THEN
    ALTER TABLE public.estoque_insumos
      ADD CONSTRAINT estoque_insumos_quantidade_nonneg
      CHECK (quantidade >= 0) NOT VALID;
  END IF;

  -- estoque_movimentos.quantidade > 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estoque_movimentos_quantidade_pos'
  ) THEN
    ALTER TABLE public.estoque_movimentos
      ADD CONSTRAINT estoque_movimentos_quantidade_pos
      CHECK (quantidade > 0) NOT VALID;
  END IF;

  -- despesas.valor >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'despesas_valor_nonneg'
  ) THEN
    ALTER TABLE public.despesas
      ADD CONSTRAINT despesas_valor_nonneg
      CHECK (valor >= 0) NOT VALID;
  END IF;

  -- receitas.valor >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receitas_valor_nonneg'
  ) THEN
    ALTER TABLE public.receitas
      ADD CONSTRAINT receitas_valor_nonneg
      CHECK (valor >= 0) NOT VALID;
  END IF;

  -- vendas.preco_unitario >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendas_preco_unitario_nonneg'
  ) THEN
    ALTER TABLE public.vendas
      ADD CONSTRAINT vendas_preco_unitario_nonneg
      CHECK (preco_unitario >= 0) NOT VALID;
  END IF;

  -- venda_parcelas.valor >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venda_parcelas_valor_nonneg'
  ) THEN
    ALTER TABLE public.venda_parcelas
      ADD CONSTRAINT venda_parcelas_valor_nonneg
      CHECK (valor >= 0) NOT VALID;
  END IF;
END $$;

-- ── 3. NOT NULL em user_id (backfill + constraint) ───────────────────────────
-- plantios e simulador_configs tinham user_id NULLABLE — RLS policies e
-- queries assumem que nunca é NULL.

-- 3a. plantios.user_id
-- Backfill: para linhas órfãs (user_id NULL), tenta deduzir via propriedade.
UPDATE public.plantios p
SET user_id = pr.user_id
FROM public.propriedades pr
WHERE p.user_id IS NULL
  AND p.propriedade_id = pr.id;

-- Delete plantios que ainda não têm dono nem propriedade — dados órfãos sem
-- como recuperar; mantemos um log via NOTICE.
DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.plantios
  WHERE user_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'audit_round4: % plantio(s) órfão(s) sem user_id removidos.', orphan_count;
    DELETE FROM public.plantios WHERE user_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.plantios
  ALTER COLUMN user_id SET NOT NULL;

-- 3b. simulador_configs.user_id
-- Linhas pré-RBAC podem ter user_id NULL — não há como deduzir o dono,
-- então deletamos (essa tabela é configuração derivada, reconstruível).
DELETE FROM public.simulador_configs WHERE user_id IS NULL;

ALTER TABLE public.simulador_configs
  ALTER COLUMN user_id SET NOT NULL;

-- ── 4. RPC: deletar movimento e ajustar saldo atomicamente ───────────────────

CREATE OR REPLACE FUNCTION public.delete_movimento_with_balance(p_movimento_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_insumo_id   uuid;
  v_tipo        text;
  v_quantidade  numeric;
  v_delta       numeric;
BEGIN
  -- Carrega o movimento (RLS aplica via USING)
  SELECT user_id, insumo_id, tipo, quantidade
    INTO v_user_id, v_insumo_id, v_tipo, v_quantidade
  FROM public.estoque_movimentos
  WHERE id = p_movimento_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Autorização explícita (SECURITY DEFINER bypassa RLS)
  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Não autorizado a excluir movimento de outro usuário';
  END IF;

  -- Inverte o efeito: entrada → subtrai; saída → soma de volta
  v_delta := CASE WHEN v_tipo = 'entrada' THEN -v_quantidade ELSE v_quantidade END;

  UPDATE public.estoque_insumos
  SET quantidade = GREATEST(0, quantidade + v_delta),
      updated_at = now()
  WHERE id = v_insumo_id;

  DELETE FROM public.estoque_movimentos WHERE id = p_movimento_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_movimento_with_balance(uuid) TO authenticated;

-- ── 5. Validar constraints adicionadas em NOT VALID ──────────────────────────
-- Tenta validar; se falhar, o constraint fica como NOT VALID e dados antigos
-- ficam tolerados, mas novos inserts já respeitam a regra.

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE conname IN (
      'estoque_insumos_quantidade_nonneg',
      'estoque_movimentos_quantidade_pos',
      'despesas_valor_nonneg',
      'receitas_valor_nonneg',
      'vendas_preco_unitario_nonneg',
      'venda_parcelas_valor_nonneg'
    )
    AND NOT convalidated
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.conname);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'audit_round4: constraint % mantida NOT VALID (dados pré-existentes violam).', c.conname;
    END;
  END LOOP;
END $$;
