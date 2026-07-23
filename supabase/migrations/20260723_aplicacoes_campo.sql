-- Caderno de Campo de Aplicações (defensivos / adubação) — exigências MAPA
-- Registro rastreável de cada aplicação em campo, base para o relatório oficial.
create table if not exists public.aplicacoes_campo (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid(),
  plantio_id        uuid not null references public.plantios(id) on delete cascade,
  data              date not null,
  tipo              text not null default 'defensivo', -- defensivo|adubacao|foliar|calagem|outro
  produto           text not null,                     -- produto comercial
  ingrediente_ativo text,                              -- princípio ativo / formulação
  classe            text,                              -- herbicida|fungicida|inseticida|acaricida|adubo|corretivo|outro
  registro_mapa     text,                              -- nº de registro MAPA do produto
  alvo              text,                              -- praga/doença/planta daninha alvo
  dose              text,                              -- ex.: "2 L/ha"
  area_ha           numeric,                           -- área tratada (ha)
  volume_calda      text,                              -- ex.: "200 L/ha"
  equipamento       text,                              -- pulverizador costal / tratorizado ...
  operador          text,                              -- responsável pela aplicação
  resp_tecnico      text,                              -- responsável técnico (agrônomo)
  crea              text,                              -- CREA/registro do RT
  receituario       text,                              -- nº do receituário agronômico
  carencia_dias     integer,                           -- intervalo de segurança (dias)
  epi               text,                              -- EPI utilizado
  clima_temp        text,                              -- temperatura (°C)
  clima_umidade     text,                              -- umidade relativa (%)
  clima_vento       text,                              -- velocidade do vento (km/h)
  obs               text,
  created_at        timestamptz not null default now()
);

alter table public.aplicacoes_campo enable row level security;

drop policy if exists aplicacoes_own on public.aplicacoes_campo;
create policy aplicacoes_own on public.aplicacoes_campo
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists aplicacoes_campo_plantio_data_idx
  on public.aplicacoes_campo (plantio_id, data desc);
