-- OryAgro Database Migration
-- Run this in Supabase Dashboard > SQL Editor

-- Plantios: records of each planting cycle
CREATE TABLE IF NOT EXISTS plantios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cultura_id TEXT NOT NULL,
  nome TEXT,
  data_plantio DATE NOT NULL,
  data_colheita_prev DATE,
  comprimento_m DECIMAL(8,2),
  largura_m DECIMAL(8,2),
  area_ha DECIMAL(8,4),
  espacamento_linhas DECIMAL(5,3),
  espacamento_plantas DECIMAL(5,3),
  total_plantas INTEGER,
  observacoes TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'colhido', 'perdido', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insumos por plantio
CREATE TABLE IF NOT EXISTS insumos_aplicados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plantio_id UUID REFERENCES plantios(id) ON DELETE CASCADE,
  cultura_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  produto TEXT NOT NULL,
  dose DECIMAL(12,3),
  unidade TEXT,
  custo_unitario DECIMAL(10,2),
  custo_total DECIMAL(10,2),
  data_aplicacao DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cronograma de atividades
CREATE TABLE IF NOT EXISTS cronograma_atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plantio_id UUID REFERENCES plantios(id) ON DELETE CASCADE,
  cultura_id TEXT NOT NULL,
  dia_previsto INTEGER NOT NULL,
  etapa TEXT NOT NULL,
  produto TEXT,
  dose TEXT,
  forma_aplicacao TEXT,
  tipo TEXT DEFAULT 'manejo',
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'feito', 'atrasado', 'ignorado')),
  data_execucao DATE,
  observacao TEXT,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Colheitas
CREATE TABLE IF NOT EXISTS colheitas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plantio_id UUID REFERENCES plantios(id) ON DELETE CASCADE,
  cultura_id TEXT NOT NULL,
  data_colheita DATE NOT NULL,
  quantidade DECIMAL(12,2),
  unidade TEXT,
  preco_unitario DECIMAL(10,2),
  receita_total DECIMAL(12,2),
  canal_venda TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custos gerais do plantio
CREATE TABLE IF NOT EXISTS custos_plantio (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plantio_id UUID REFERENCES plantios(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  descricao TEXT,
  valor DECIMAL(12,2) NOT NULL,
  data_custo DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuracoes do simulador salvas
CREATE TABLE IF NOT EXISTS simulador_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cultura_id TEXT NOT NULL UNIQUE,
  valores JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE plantios ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos_aplicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronograma_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE colheitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_plantio ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulador_configs ENABLE ROW LEVEL SECURITY;

-- Policies - allow all for anon (restrict later with auth)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_plantios') THEN
    CREATE POLICY "allow_all_plantios" ON plantios FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_insumos') THEN
    CREATE POLICY "allow_all_insumos" ON insumos_aplicados FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_cronograma') THEN
    CREATE POLICY "allow_all_cronograma" ON cronograma_atividades FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_colheitas') THEN
    CREATE POLICY "allow_all_colheitas" ON colheitas FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_custos') THEN
    CREATE POLICY "allow_all_custos" ON custos_plantio FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_simulador') THEN
    CREATE POLICY "allow_all_simulador" ON simulador_configs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
