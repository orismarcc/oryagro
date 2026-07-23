-- Sistema de irrigação instalado por talhão — alimenta o cálculo de tempo de acionamento
alter table public.talhoes add column if not exists irrigacao_tipo            text;    -- gotejamento|microaspersao|aspersao|nenhum
alter table public.talhoes add column if not exists irrigacao_taxa_mm_h       numeric; -- taxa de aplicação do sistema (mm/h)
alter table public.talhoes add column if not exists irrigacao_vazao_emissor_lh numeric; -- vazão por emissor (L/h)
alter table public.talhoes add column if not exists irrigacao_area_emissor_m2  numeric; -- área atendida por emissor (m²)
alter table public.talhoes add column if not exists irrigacao_eficiencia      numeric; -- 0–1 (default por tipo)
