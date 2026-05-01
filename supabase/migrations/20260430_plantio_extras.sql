-- Migração: campos extras em plantios
-- metodo_propagacao: qual método foi usado (estaquia, alporquia, semente, muda_enxertada…)
-- area_plantada_ha: quanto do lote já foi efetivamente plantado (plantio parcelado)

alter table plantios add column if not exists metodo_propagacao text;
alter table plantios add column if not exists area_plantada_ha  numeric;
