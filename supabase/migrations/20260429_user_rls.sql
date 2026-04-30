-- Migração: user_id + Row Level Security
-- OryAgro — isolamento de dados por usuário

-- 1. Colunas user_id
alter table plantios          add column if not exists user_id uuid references auth.users(id);
alter table simulador_configs add column if not exists user_id uuid references auth.users(id);

-- 2. Constraint de unicidade em simulador_configs por (user_id, cultura_id)
alter table simulador_configs drop constraint if exists simulador_configs_cultura_id_key;
alter table simulador_configs drop constraint if exists simulador_configs_user_cultura;
alter table simulador_configs add constraint simulador_configs_user_cultura unique (user_id, cultura_id);

-- 3. Row Level Security
alter table plantios          enable row level security;
alter table simulador_configs enable row level security;

-- 4. Políticas: cada usuário acessa apenas seus próprios dados
drop policy if exists "user_own_plantios"          on plantios;
drop policy if exists "user_own_simulador_configs" on simulador_configs;

create policy "user_own_plantios"
  on plantios for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_own_simulador_configs"
  on simulador_configs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
