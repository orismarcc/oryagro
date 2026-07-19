-- 20260629_estacas_espaldeira.sql
-- Quantidade de estacas/mourões da espaldeira para culturas que a exigem
-- (ex.: maracujá, uva). Pré-preenchida por um padrão da cultura no cadastro
-- do lote e editável pelo usuário.
ALTER TABLE plantios ADD COLUMN IF NOT EXISTS estacas integer;
COMMENT ON COLUMN plantios.estacas IS 'Nº de estacas/mourões da espaldeira (culturas em espaldeira: maracujá, uva…)';
