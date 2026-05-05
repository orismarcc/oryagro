-- ── 20260506_rls_hardening.sql ──────────────────────────────────────────────
-- Corrige 4 tabelas com USING: true (dados visíveis a qualquer usuário logado)
-- e remove política duplicada em diario_campo.
--
-- Tabelas afetadas:
--   colheitas, cronograma_atividades, custos_plantio, insumos_aplicados
--   → não têm user_id direto; ownership passa por plantio_id → plantios.user_id
--
-- Padrão:
--   Policy "owner"       → acesso do dono (via plantios.user_id = auth.uid())
--   Policy "farm_member" → acesso de membros convidados (via propriedade → farm_members)
-- ────────────────────────────────────────────────────────────────────────────


-- ── colheitas ────────────────────────────────────────────────────────────────

-- Remove policy aberta (USING: true)
DROP POLICY IF EXISTS "allow_all_colheitas" ON public.colheitas;

-- Dono do plantio tem acesso total
CREATE POLICY "colheitas_owner" ON public.colheitas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plantios p
      WHERE p.id = colheitas.plantio_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plantios p
      WHERE p.id = colheitas.plantio_id
        AND p.user_id = auth.uid()
    )
  );

-- Membros convidados (farm_members) têm acesso ao plantio da propriedade
CREATE POLICY "colheitas_farm_member" ON public.colheitas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.plantios p
      JOIN public.farm_members fm ON fm.farm_id = p.propriedade_id
      WHERE p.id = colheitas.plantio_id
        AND fm.user_id = auth.uid()
    )
  );


-- ── cronograma_atividades ────────────────────────────────────────────────────

-- Remove policy aberta (USING: true) — já existe farm_member policy correta
DROP POLICY IF EXISTS "allow_all_cronograma" ON public.cronograma_atividades;

-- Dono do plantio tem acesso total
CREATE POLICY "cronograma_owner" ON public.cronograma_atividades
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plantios p
      WHERE p.id = cronograma_atividades.plantio_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plantios p
      WHERE p.id = cronograma_atividades.plantio_id
        AND p.user_id = auth.uid()
    )
  );

-- Nota: "farm_members_can_access_cronograma" já existe e cobre membros convidados.


-- ── custos_plantio ───────────────────────────────────────────────────────────

-- Remove policy aberta (USING: true)
DROP POLICY IF EXISTS "allow_all_custos" ON public.custos_plantio;

-- Dono do plantio tem acesso total
CREATE POLICY "custos_owner" ON public.custos_plantio
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plantios p
      WHERE p.id = custos_plantio.plantio_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plantios p
      WHERE p.id = custos_plantio.plantio_id
        AND p.user_id = auth.uid()
    )
  );

-- Membros convidados
CREATE POLICY "custos_farm_member" ON public.custos_plantio
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.plantios p
      JOIN public.farm_members fm ON fm.farm_id = p.propriedade_id
      WHERE p.id = custos_plantio.plantio_id
        AND fm.user_id = auth.uid()
    )
  );


-- ── insumos_aplicados ────────────────────────────────────────────────────────

-- Remove policy aberta (USING: true)
DROP POLICY IF EXISTS "allow_all_insumos" ON public.insumos_aplicados;

-- Dono do plantio tem acesso total
CREATE POLICY "insumos_owner" ON public.insumos_aplicados
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.plantios p
      WHERE p.id = insumos_aplicados.plantio_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.plantios p
      WHERE p.id = insumos_aplicados.plantio_id
        AND p.user_id = auth.uid()
    )
  );

-- Membros convidados
CREATE POLICY "insumos_farm_member" ON public.insumos_aplicados
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.plantios p
      JOIN public.farm_members fm ON fm.farm_id = p.propriedade_id
      WHERE p.id = insumos_aplicados.plantio_id
        AND fm.user_id = auth.uid()
    )
  );


-- ── diario_campo — remover policy duplicada ──────────────────────────────────
-- "Users manage own diario" e "user_own_diario" têm o mesmo USING.
-- Mantemos apenas "user_own_diario" que tem WITH CHECK explícito.
DROP POLICY IF EXISTS "Users manage own diario" ON public.diario_campo;


-- ── Índices de performance (subqueries de RLS acima) ─────────────────────────
-- Aceleram as subqueries de ownership em todas as tabelas corrigidas.

CREATE INDEX IF NOT EXISTS idx_colheitas_plantio_id
  ON public.colheitas(plantio_id);

CREATE INDEX IF NOT EXISTS idx_custos_plantio_plantio_id
  ON public.custos_plantio(plantio_id);

CREATE INDEX IF NOT EXISTS idx_insumos_aplicados_plantio_id
  ON public.insumos_aplicados(plantio_id);
