-- Migração: rastrear progresso de mudas no viveiro
-- mudas_feitas: quantas mudas/estacas/alporquias já foram preparadas
alter table plantios add column if not exists mudas_feitas integer;
