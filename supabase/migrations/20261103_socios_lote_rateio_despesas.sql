-- ════════════════════════════════════════════════════════════════════════════
-- Membros por LOTE, rateio de despesas entre membros (com pendências de
-- pagamento), comprovantes anexos e compras da propriedade distribuídas
-- entre os lotes.
--
-- Modelo:
--   lote_membros     quem participa de cada lote (por e-mail; o user_id é ligado
--                    sozinho quando a pessoa cria a conta com esse e-mail).
--   despesas         + despesa_origem_id: a compra da PROPRIEDADE (sem lote) é a
--                    "mãe"; cada destino é uma despesa filha no lote (é ela que
--                    entra no financeiro do lote — a mãe não, evitando contar 2×).
--                    + pagador_membro_id: quem adiantou o valor (opcional).
--   despesa_rateios  quanto cada membro do lote paga daquela despesa, com status
--                    pago/pendente e quitação.
--   despesa_anexos   comprovantes (foto/PDF) no bucket privado.
-- Acesso: o dono da propriedade e os membros da fazenda veem tudo; o membro de
-- um lote vê só aquele lote (e seus registros, despesas, vendas e produção).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Membros do lote ─────────────────────────────────────────────────────────
create table if not exists public.lote_membros (
  id         uuid primary key default gen_random_uuid(),
  plantio_id uuid not null references public.plantios(id) on delete cascade,
  email      text not null,
  nome       text not null,
  user_id    uuid references auth.users(id) on delete set null,
  papel      text not null default 'membro' check (papel in ('admin', 'membro')),
  created_at timestamptz not null default now()
);
create unique index if not exists lote_membros_lote_email on public.lote_membros (plantio_id, lower(email));
create index if not exists lote_membros_user_idx on public.lote_membros (user_id);

-- Funções de acesso (SECURITY DEFINER: evitam recursão de RLS)
create or replace function public.is_lote_membro(p_plantio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lote_membros where plantio_id = p_plantio and user_id = auth.uid());
$$;

-- Gestor do lote = dono do lote, dono/admin da propriedade ou admin do lote
create or replace function public.pode_gerir_lote(p_plantio uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.plantios p
    left join public.propriedades pr on pr.id = p.propriedade_id
    where p.id = p_plantio and (
      p.user_id = auth.uid()
      or pr.user_id = auth.uid()
      or exists (select 1 from public.farm_members fm
                 where fm.farm_id = p.propriedade_id and fm.user_id = auth.uid() and fm.role = 'admin')
      or exists (select 1 from public.lote_membros lm
                 where lm.plantio_id = p.id and lm.user_id = auth.uid() and lm.papel = 'admin')));
$$;

create or replace function public.is_membro_de_lote_da_propriedade(p_prop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lote_membros lm join public.plantios p on p.id = lm.plantio_id
                 where p.propriedade_id = p_prop and lm.user_id = auth.uid());
$$;

alter table public.lote_membros enable row level security;
drop policy if exists lote_membros_ler on public.lote_membros;
create policy lote_membros_ler on public.lote_membros for select
  using (public.pode_gerir_lote(plantio_id) or public.is_lote_membro(plantio_id)
         or exists (select 1 from public.plantios p where p.id = plantio_id and p.propriedade_id is not null
                    and public.is_farm_member(p.propriedade_id)));
drop policy if exists lote_membros_gerir on public.lote_membros;
create policy lote_membros_gerir on public.lote_membros for all
  using (public.pode_gerir_lote(plantio_id)) with check (public.pode_gerir_lote(plantio_id));

-- Liga o membro à conta quando ela é criada (ou já existe) com o mesmo e-mail
create or replace function public.tg_lote_membros_liga_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.user_id is null then
    select id into NEW.user_id from auth.users where lower(email) = lower(NEW.email);
  end if;
  return NEW;
end $$;
drop trigger if exists trg_lote_membros_liga_usuario on public.lote_membros;
create trigger trg_lote_membros_liga_usuario before insert or update of email on public.lote_membros
  for each row execute function public.tg_lote_membros_liga_usuario();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (NEW.id, NEW.email, NEW.raw_user_meta_data->>'display_name')
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name);
  -- Convites de lote feitos antes da conta existir
  update public.lote_membros set user_id = NEW.id
   where user_id is null and lower(email) = lower(NEW.email);
  return NEW;
end $$;

-- 2. Acesso do membro de lote às tabelas do lote ────────────────────────────
drop policy if exists plantios_lote_membro_ler on public.plantios;
create policy plantios_lote_membro_ler on public.plantios for select using (public.is_lote_membro(id));
drop policy if exists plantios_lote_admin_editar on public.plantios;
create policy plantios_lote_admin_editar on public.plantios for update
  using (public.pode_gerir_lote(id)) with check (public.pode_gerir_lote(id));

drop policy if exists propriedades_lote_membro_ler on public.propriedades;
create policy propriedades_lote_membro_ler on public.propriedades for select
  using (public.is_membro_de_lote_da_propriedade(id));

drop policy if exists cronograma_lote_membro on public.cronograma_atividades;
create policy cronograma_lote_membro on public.cronograma_atividades for all
  using (public.is_lote_membro(plantio_id)) with check (public.is_lote_membro(plantio_id));

drop policy if exists atividade_fotos_lote_membro on public.atividade_fotos;
create policy atividade_fotos_lote_membro on public.atividade_fotos for all
  using (exists (select 1 from public.cronograma_atividades ca
                 where ca.id = atividade_fotos.atividade_id and public.is_lote_membro(ca.plantio_id)));

drop policy if exists despesas_lote_membro_ler on public.despesas;
create policy despesas_lote_membro_ler on public.despesas for select
  using (plantio_id is not null and public.is_lote_membro(plantio_id));
drop policy if exists despesas_gestor_lote on public.despesas;
create policy despesas_gestor_lote on public.despesas for all
  using (plantio_id is not null and public.pode_gerir_lote(plantio_id))
  with check (plantio_id is not null and public.pode_gerir_lote(plantio_id));

drop policy if exists vendas_lote_membro_ler on public.vendas;
create policy vendas_lote_membro_ler on public.vendas for select
  using (plantio_id is not null and public.is_lote_membro(plantio_id));

drop policy if exists producao_lote_membro on public.producao_registros;
create policy producao_lote_membro on public.producao_registros for select
  using (public.is_lote_membro(plantio_id) or public.pode_gerir_lote(plantio_id));

-- Estoque da propriedade: membro de lote só LÊ (para escolher o produto no Anotar)
drop policy if exists estoque_insumos_lote_membro_ler on public.estoque_insumos;
create policy estoque_insumos_lote_membro_ler on public.estoque_insumos for select
  using (propriedade_id is not null and public.is_membro_de_lote_da_propriedade(propriedade_id));

-- 3. Despesas: origem (compra da propriedade) e pagador ──────────────────────
alter table public.despesas
  add column if not exists despesa_origem_id uuid references public.despesas(id) on delete cascade,
  add column if not exists pagador_membro_id uuid references public.lote_membros(id) on delete set null;
create index if not exists despesas_origem_idx on public.despesas (despesa_origem_id);
create index if not exists despesas_pagador_idx on public.despesas (pagador_membro_id);

-- 4. Rateio entre membros ─────────────────────────────────────────────────────
create table if not exists public.despesa_rateios (
  id          uuid primary key default gen_random_uuid(),
  despesa_id  uuid not null references public.despesas(id) on delete cascade,
  membro_id   uuid not null references public.lote_membros(id) on delete cascade,
  valor       numeric not null check (valor >= 0),
  status      text not null default 'pendente' check (status in ('pago', 'pendente')),
  quitado_em  date,
  quitado_por uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (despesa_id, membro_id)
);
create index if not exists despesa_rateios_membro_idx on public.despesa_rateios (membro_id);

alter table public.despesa_rateios enable row level security;
drop policy if exists despesa_rateios_ler on public.despesa_rateios;
create policy despesa_rateios_ler on public.despesa_rateios for select
  using (exists (select 1 from public.despesas d where d.id = despesa_id
                 and (d.user_id = auth.uid() or public.pode_gerir_lote(d.plantio_id) or public.is_lote_membro(d.plantio_id))));
drop policy if exists despesa_rateios_gerir on public.despesa_rateios;
create policy despesa_rateios_gerir on public.despesa_rateios for all
  using (exists (select 1 from public.despesas d where d.id = despesa_id
                 and (d.user_id = auth.uid() or public.pode_gerir_lote(d.plantio_id))))
  with check (exists (select 1 from public.despesas d where d.id = despesa_id
                      and (d.user_id = auth.uid() or public.pode_gerir_lote(d.plantio_id))));
-- Quitação: qualquer membro do lote pode marcar como pago (fica registrado quem/quando)
drop policy if exists despesa_rateios_quitar on public.despesa_rateios;
create policy despesa_rateios_quitar on public.despesa_rateios for update
  using (exists (select 1 from public.despesas d where d.id = despesa_id and public.is_lote_membro(d.plantio_id)))
  with check (exists (select 1 from public.despesas d where d.id = despesa_id and public.is_lote_membro(d.plantio_id)));

-- 5. Comprovantes ─────────────────────────────────────────────────────────────
create table if not exists public.despesa_anexos (
  id           uuid primary key default gen_random_uuid(),
  despesa_id   uuid not null references public.despesas(id) on delete cascade,
  storage_path text not null,
  nome         text,
  mime         text,
  created_at   timestamptz not null default now()
);
create index if not exists despesa_anexos_despesa_idx on public.despesa_anexos (despesa_id);

alter table public.despesa_anexos enable row level security;
drop policy if exists despesa_anexos_acesso on public.despesa_anexos;
create policy despesa_anexos_acesso on public.despesa_anexos for all
  using (exists (select 1 from public.despesas d where d.id = despesa_id
                 and (d.user_id = auth.uid() or public.pode_gerir_lote(d.plantio_id) or public.is_lote_membro(d.plantio_id)
                      or exists (select 1 from public.despesas f where f.despesa_origem_id = d.id
                                 and (public.pode_gerir_lote(f.plantio_id) or public.is_lote_membro(f.plantio_id))))))
  with check (exists (select 1 from public.despesas d where d.id = despesa_id
                      and (d.user_id = auth.uid() or public.pode_gerir_lote(d.plantio_id))));

-- Arquivos dos comprovantes ficam em user/<uid-de-quem-enviou>/despesas/...;
-- para os outros membros do lote verem, leitura liberada pela tabela de anexos.
drop policy if exists anexos_storage_select_despesas on storage.objects;
create policy anexos_storage_select_despesas on storage.objects for select to authenticated
  using (bucket_id = 'oryagro-attachments'
         and exists (select 1 from public.despesa_anexos a where a.storage_path = storage.objects.name));
