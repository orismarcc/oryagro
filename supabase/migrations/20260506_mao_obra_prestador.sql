-- ── 20260506_mao_obra_prestador.sql ─────────────────────────────────────────
-- Adiciona coluna prestador à tabela mao_obra_registros
-- para registrar nome da pessoa ou empresa que prestou o serviço.

ALTER TABLE public.mao_obra_registros
  ADD COLUMN IF NOT EXISTS prestador text;
