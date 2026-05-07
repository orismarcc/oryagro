-- ── 20260507_despesas.sql ──────────────────────────────────────────────────────
-- Módulo Despesas: tabela centralizada de despesas por lote/propriedade
-- Substitui o uso de mao_obra_registros como custo geral (mantém tabela original)
-- Adiciona campo categoria em vendas
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabela despesas ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.despesas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  propriedade_id  uuid REFERENCES public.propriedades(id) ON DELETE SET NULL,
  plantio_id      uuid REFERENCES public.plantios(id) ON DELETE SET NULL,
  categoria       text NOT NULL,
  subcategoria    text,
  descricao       text,
  prestador       text,
  valor           numeric(12,2) NOT NULL DEFAULT 0,
  data            date NOT NULL,
  observacao      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 2. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- Owner: full access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "despesas_owner" ON public.despesas;
CREATE POLICY "despesas_owner" ON public.despesas
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Farm members: read access via plantio → propriedade
DROP POLICY IF EXISTS "despesas_farm_member" ON public.despesas;
CREATE POLICY "despesas_farm_member" ON public.despesas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.plantios p
      JOIN public.farm_members fm ON fm.farm_id = p.propriedade_id
      WHERE p.id = despesas.plantio_id
        AND fm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.farm_members fm
      WHERE fm.farm_id = despesas.propriedade_id
        AND fm.user_id = auth.uid()
    )
  );

-- ── 3. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_despesas_updated_at()
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

DROP TRIGGER IF EXISTS trg_despesas_updated_at ON public.despesas;
CREATE TRIGGER trg_despesas_updated_at
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.set_despesas_updated_at();

-- ── 4. Performance indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_despesas_user_id        ON public.despesas(user_id);
CREATE INDEX IF NOT EXISTS idx_despesas_plantio_id     ON public.despesas(plantio_id);
CREATE INDEX IF NOT EXISTS idx_despesas_propriedade_id ON public.despesas(propriedade_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data           ON public.despesas(data DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_categoria      ON public.despesas(categoria);

-- ── 5. Migrate mao_obra_registros → despesas (idempotent) ────────────────────
-- Maps existing labor records to the "Mão de Obra" category.
-- The original mao_obra_registros table is NOT dropped (backward compat).

INSERT INTO public.despesas (
  id, user_id, plantio_id, categoria, subcategoria,
  descricao, prestador, valor, data, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  m.user_id,
  m.plantio_id,
  'Mão de Obra',
  NULL,
  m.descricao,
  m.prestador,
  COALESCE(m.valor, 0),
  COALESCE(m.data_inicio::date, now()::date),
  COALESCE(m.created_at, now()),
  COALESCE(m.created_at, now())
FROM public.mao_obra_registros m
WHERE NOT EXISTS (
  SELECT 1 FROM public.despesas d
  WHERE d.user_id    = m.user_id
    AND d.plantio_id = m.plantio_id
    AND d.categoria  = 'Mão de Obra'
    AND d.descricao  IS NOT DISTINCT FROM m.descricao
    AND d.prestador  IS NOT DISTINCT FROM m.prestador
    AND d.valor      = COALESCE(m.valor, 0)
    AND d.data       = COALESCE(m.data_inicio::date, now()::date)
);

-- ── 6. Add categoria column to vendas ────────────────────────────────────────

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'Venda de produção in-natura';
