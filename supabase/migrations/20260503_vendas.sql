-- ─── Migration: vendas ────────────────────────────────────────────────────────
-- Documenta a tabela 'vendas' usada pelo código (I-13: schema antes implícito).
-- Cria a tabela se ainda não existir; segura para re-execução.
--
-- Colunas reais confirmadas pelo código em useGestao.js (addVenda):
--   plantio_id, data, quantidade, unidade, preco_unitario, destino, observacao

CREATE TABLE IF NOT EXISTS public.vendas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plantio_id      uuid NOT NULL REFERENCES public.plantios(id) ON DELETE CASCADE,
  data            date NOT NULL,
  quantidade      numeric NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  unidade         text NOT NULL DEFAULT 'kg',
  preco_unitario  numeric NOT NULL DEFAULT 0,
  destino         text NOT NULL DEFAULT 'outros',
  observacao      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance nas queries mais comuns
CREATE INDEX IF NOT EXISTS vendas_user_id_idx        ON public.vendas (user_id);
CREATE INDEX IF NOT EXISTS vendas_plantio_id_idx     ON public.vendas (plantio_id);
CREATE INDEX IF NOT EXISTS vendas_data_idx           ON public.vendas (data DESC);

-- RLS
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- Proprietário e membros da fazenda podem ler vendas do lote
CREATE POLICY IF NOT EXISTS "vendas_select" ON public.vendas
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.plantios p
      JOIN public.farm_members fm ON fm.farm_id = p.propriedade_id
      WHERE p.id = vendas.plantio_id
        AND fm.user_id = auth.uid()
    )
  );

-- Apenas o proprietário ou admin pode inserir/atualizar/deletar
CREATE POLICY IF NOT EXISTS "vendas_insert" ON public.vendas
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "vendas_update" ON public.vendas
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "vendas_delete" ON public.vendas
  FOR DELETE USING (user_id = auth.uid());

-- ─── RPC: adjust_insumo_quantidade ───────────────────────────────────────────
-- Atualiza a quantidade de um insumo de forma atômica (I-08: evita race condition).
-- p_delta: positivo = entrada, negativo = saída. Nunca deixa abaixo de 0.

CREATE OR REPLACE FUNCTION public.adjust_insumo_quantidade(
  p_insumo_id uuid,
  p_delta     numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.estoque_insumos
  SET
    quantidade   = GREATEST(0, quantidade + p_delta),
    updated_at   = now()
  WHERE id = p_insumo_id;
END;
$$;
