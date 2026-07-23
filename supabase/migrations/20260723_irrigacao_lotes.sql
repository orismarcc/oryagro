-- Sistema de irrigação também nos lotes/safras (culturas anuais e safras de talhão)
alter table public.plantios add column if not exists irrigacao_tipo             text;
alter table public.plantios add column if not exists irrigacao_taxa_mm_h        numeric;
alter table public.plantios add column if not exists irrigacao_vazao_emissor_lh numeric;
alter table public.plantios add column if not exists irrigacao_area_emissor_m2  numeric;
alter table public.plantios add column if not exists irrigacao_eficiencia       numeric;
