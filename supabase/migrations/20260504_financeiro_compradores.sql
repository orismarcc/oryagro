-- ============================================================
-- Migration: 20260504_financeiro_compradores.sql
-- Novas tabelas: compradores, venda_parcelas, mao_obra_registros,
--                ciclos_historico
-- Alterações:    vendas.comprador_id
--                cronograma_atividades.data_override (reservado)
-- ============================================================

-- ── compradores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compradores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  documento        text,                        -- CPF ou CNPJ (só dígitos)
  tipo_documento   text NOT NULL DEFAULT 'cpf', -- 'cpf' | 'cnpj'
  nome             text NOT NULL,
  tipo             text NOT NULL DEFAULT 'outros', -- 'varejo'|'atacado'|'pnae'|'outros'
  telefone         text,
  cidade           text,
  status           text NOT NULL DEFAULT 'ativo', -- 'ativo' | 'inativo'
  observacao       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE compradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compradores_own_all"
  ON compradores FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── venda_parcelas ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venda_parcelas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venda_id         uuid NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  numero_parcela   integer NOT NULL DEFAULT 1,
  valor            numeric(12,2) NOT NULL DEFAULT 0,
  data_vencimento  date NOT NULL,
  status           text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'pago'
  data_pagamento   date,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE venda_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venda_parcelas_own_all"
  ON venda_parcelas FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── mao_obra_registros ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mao_obra_registros (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plantio_id   uuid NOT NULL REFERENCES plantios(id) ON DELETE CASCADE,
  data_inicio  date NOT NULL,
  data_fim     date,                      -- NULL = entrada de dia único
  valor        numeric(12,2) NOT NULL DEFAULT 0,
  descricao    text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE mao_obra_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mao_obra_registros_own_all"
  ON mao_obra_registros FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── ciclos_historico ──────────────────────────────────────────
-- Armazena o resumo de cada ciclo concluído (migra do localStorage)
CREATE TABLE IF NOT EXISTS ciclos_historico (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lote_id          uuid NOT NULL,   -- sem FK — lote pode ter sido deletado
  lote_nome        text NOT NULL,
  cultura_id       text NOT NULL,
  data_plantio     date,
  data_conclusao   date,
  total_vendas_kg  numeric(12,2) DEFAULT 0,
  receita_total    numeric(12,2) DEFAULT 0,
  custo_insumos    numeric(12,2) DEFAULT 0,
  custo_mao_obra   numeric(12,2) DEFAULT 0,
  dias_ciclo_real  integer,
  archived_at      timestamptz DEFAULT now()
);

ALTER TABLE ciclos_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ciclos_historico_own_all"
  ON ciclos_historico FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Alterações em tabelas existentes ─────────────────────────

-- vendas: referência ao comprador (opcional — backward-compat)
ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS comprador_id uuid
    REFERENCES compradores(id) ON DELETE SET NULL;

-- cronograma_atividades: override de data (reservado para futura feature)
ALTER TABLE cronograma_atividades
  ADD COLUMN IF NOT EXISTS data_override date;

-- ── Índices úteis ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_venda_parcelas_venda_id
  ON venda_parcelas (venda_id);

CREATE INDEX IF NOT EXISTS idx_venda_parcelas_status_vencimento
  ON venda_parcelas (user_id, status, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_mao_obra_plantio
  ON mao_obra_registros (user_id, plantio_id);

CREATE INDEX IF NOT EXISTS idx_ciclos_historico_lote
  ON ciclos_historico (user_id, lote_id);

CREATE INDEX IF NOT EXISTS idx_compradores_user
  ON compradores (user_id, status);
