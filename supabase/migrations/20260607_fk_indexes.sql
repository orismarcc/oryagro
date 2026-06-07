-- ── 20260607_fk_indexes.sql ──────────────────────────────────────────────────
-- Performance: adiciona índices em foreign keys que não tinham cobertura.
-- Sem um índice na coluna da FK, filtros/joins por essa coluna fazem seq scan e
-- DELETEs na tabela referenciada precisam varrer a tabela filha inteira.
-- Todos são CREATE INDEX IF NOT EXISTS (idempotente, seguro de reaplicar).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_plantios_propriedade_id         ON public.plantios(propriedade_id);
CREATE INDEX IF NOT EXISTS idx_diario_campo_user_id            ON public.diario_campo(user_id);
CREATE INDEX IF NOT EXISTS idx_diario_campo_plantio_id         ON public.diario_campo(plantio_id);
CREATE INDEX IF NOT EXISTS idx_estoque_insumos_propriedade_id  ON public.estoque_insumos(propriedade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_insumos_user_id         ON public.estoque_insumos(user_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_user_id      ON public.estoque_movimentos(user_id);
CREATE INDEX IF NOT EXISTS idx_propriedades_user_id            ON public.propriedades(user_id);
CREATE INDEX IF NOT EXISTS idx_vendas_comprador_id             ON public.vendas(comprador_id);
CREATE INDEX IF NOT EXISTS idx_farm_members_invited_by         ON public.farm_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_ciclos_historico_talhao_id      ON public.ciclos_historico(talhao_id);
CREATE INDEX IF NOT EXISTS idx_producao_registros_user_id      ON public.producao_registros(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notificacoes_plantio_id ON public.whatsapp_notificacoes(plantio_id);
