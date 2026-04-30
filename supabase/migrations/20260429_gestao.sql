-- Migração: tabelas de gestão da propriedade
-- OryAgro — diário de campo, estoque de insumos e movimentos

-- ── Diário de campo ──────────────────────────────────────────────────────────
create table if not exists diario_campo (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) not null,
  plantio_id  uuid references plantios(id) on delete set null,
  data        date not null default current_date,
  tipo        text not null default 'observacao',
  -- tipos: observacao | praga | colheita | clima | outro
  texto       text not null,
  created_at  timestamptz default now()
);

-- ── Estoque de insumos ───────────────────────────────────────────────────────
create table if not exists estoque_insumos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) not null,
  nome              text not null,
  unidade           text not null default 'kg',
  quantidade        numeric not null default 0,
  quantidade_minima numeric not null default 0,
  preco_unitario    numeric default 0,
  updated_at        timestamptz default now()
);

-- ── Movimentos de estoque ────────────────────────────────────────────────────
create table if not exists estoque_movimentos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) not null,
  insumo_id  uuid references estoque_insumos(id) on delete cascade not null,
  tipo       text not null, -- entrada | saida
  quantidade numeric not null,
  observacao text,
  data       date not null default current_date,
  created_at timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table diario_campo        enable row level security;
alter table estoque_insumos     enable row level security;
alter table estoque_movimentos  enable row level security;

drop policy if exists "user_own_diario"               on diario_campo;
drop policy if exists "user_own_estoque_insumos"      on estoque_insumos;
drop policy if exists "user_own_estoque_movimentos"   on estoque_movimentos;

create policy "user_own_diario"
  on diario_campo for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_own_estoque_insumos"
  on estoque_insumos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_own_estoque_movimentos"
  on estoque_movimentos for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
