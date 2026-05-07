-- ── 20260507_despesas_qty_receitas.sql ──────────────────────────────────────
-- 1. Adds quantidade + unidade columns to despesas
-- 2. Creates the receitas table with RLS, trigger, and indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Novos campos em despesas ───────────────────────────────────────────────

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS quantidade numeric(12,3),
  ADD COLUMN IF NOT EXISTS unidade    text;

-- ── 2. Tabela receitas ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.receitas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  propriedade_id  uuid REFERENCES public.propriedades(id) ON DELETE SET NULL,
  plantio_id      uuid REFERENCES public.plantios(id)    ON DELETE SET NULL,
  categoria       text NOT NULL,
  descricao       text,
  comprador       text,
  quantidade      numeric(12,3),
  unidade         text,
  valor           numeric(12,2) NOT NULL DEFAULT 0,
  data            date NOT NULL,
  observacao      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 3. RLS em receitas ────────────────────────────────────────────────────────

ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;

-- Owner: full access
DROP POLICY IF EXISTS "receitas_owner" ON public.receitas;
CREATE POLICY "receitas_owner" ON public.receitas
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Farm members: read access via plantio → propriedade
DROP POLICY IF EXISTS "receitas_farm_member" ON public.receitas;
CREATE POLICY "receitas_farm_member" ON public.receitas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.plantios p
      JOIN public.farm_members fm ON fm.farm_id = p.propriedade_id
      WHERE p.id = receitas.plantio_id
        AND fm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.farm_members fm
      WHERE fm.farm_id = receitas.propriedade_id
        AND fm.user_id = auth.uid()
    )
  );

-- ── 4. updated_at trigger para receitas ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_receitas_updated_at()
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

DROP TRIGGER IF EXISTS trg_receitas_updated_at ON public.receitas;
CREATE TRIGGER trg_receitas_updated_at
  BEFORE UPDATE ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.set_receitas_updated_at();

-- ── 5. Índices de performance ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_receitas_user_id        ON public.receitas(user_id);
CREATE INDEX IF NOT EXISTS idx_receitas_plantio_id     ON public.receitas(plantio_id);
CREATE INDEX IF NOT EXISTS idx_receitas_propriedade_id ON public.receitas(propriedade_id);
CREATE INDEX IF NOT EXISTS idx_receitas_data           ON public.receitas(data DESC);
CREATE INDEX IF NOT EXISTS idx_receitas_categoria      ON public.receitas(categoria);
