-- 20260629_analise_solo.sql
-- Adiciona à tabela de lotes (plantios) o tipo de solo e a análise de solo
-- (painel essencial), usados para gerar a adubação/calagem do cronograma a
-- partir da interpretação agronômica (método V% / Embrapa-CFSEMG).
--
-- tipo_solo    : textura/descrição do solo informada no cadastro do lote
-- analise_solo : painel essencial em JSON, ex.:
--   { "ph": 4.4, "p": 2.3, "k": 76.5, "ca": 1.1, "mg": 0.4, "al": 0.5,
--     "hAl": 2.7, "mo": 16, "zn": 1.5, "argila": 16, "prnt": 80,
--     "data": "2026-06-26", "lab": "Solocria VND 10465" }

ALTER TABLE plantios ADD COLUMN IF NOT EXISTS tipo_solo    text;
ALTER TABLE plantios ADD COLUMN IF NOT EXISTS analise_solo jsonb;

COMMENT ON COLUMN plantios.tipo_solo    IS 'Textura/tipo de solo do lote (ex.: Franco-Arenoso)';
COMMENT ON COLUMN plantios.analise_solo IS 'Painel essencial de análise de solo (JSON) para gerar adubação/calagem do cronograma';
