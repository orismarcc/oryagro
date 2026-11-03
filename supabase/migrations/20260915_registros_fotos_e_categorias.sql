-- ════════════════════════════════════════════════════════════════════════════
-- Cronograma do lote vira REGISTRO do produtor (agendado/realizado) + fotos.
--
-- Aplicada no banco em 15/09/2026 (commit 6e6400e) sem arquivo no repositório;
-- este arquivo foi reconstruído em 03/11/2026 a partir do estado real do banco
-- e é idempotente (pode rodar de novo sem efeito).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Colunas do registro ─────────────────────────────────────────────────────
alter table public.cronograma_atividades
  add column if not exists categoria     text,
  add column if not exists quantidade    numeric,
  add column if not exists unidade       text,
  add column if not exists insumo_id     uuid,
  add column if not exists data_prevista date;

-- Registros por data não têm "dia do ciclo"
alter table public.cronograma_atividades alter column dia_previsto drop not null;

do $$ begin
  alter table public.cronograma_atividades
    add constraint cronograma_atividades_insumo_id_fkey
    foreign key (insumo_id) references public.estoque_insumos(id) on delete set null;
exception when duplicate_object then null; end $$;

-- 2. Fotos dos registros ─────────────────────────────────────────────────────
create table if not exists public.atividade_fotos (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.cronograma_atividades(id) on delete cascade,
  storage_path text not null,
  legenda      text,
  created_at   timestamptz not null default now()
);
create index if not exists atividade_fotos_atividade_idx on public.atividade_fotos (atividade_id);

alter table public.atividade_fotos enable row level security;

drop policy if exists atividade_fotos_owner on public.atividade_fotos;
create policy atividade_fotos_owner on public.atividade_fotos
  for all using (exists (
    select 1 from public.cronograma_atividades ca
    join public.plantios p on p.id = ca.plantio_id
    where ca.id = atividade_fotos.atividade_id and p.user_id = auth.uid()));

drop policy if exists atividade_fotos_farm_members on public.atividade_fotos;
create policy atividade_fotos_farm_members on public.atividade_fotos
  for all using (exists (
    select 1 from public.cronograma_atividades ca
    join public.plantios p on p.id = ca.plantio_id
    join public.farm_members fm on fm.farm_id = p.propriedade_id
    where ca.id = atividade_fotos.atividade_id and fm.user_id = auth.uid()));

-- 3. Storage: bucket privado, arquivos em user/<auth.uid()>/... ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oryagro-attachments', 'oryagro-attachments', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists anexos_storage_select on storage.objects;
create policy anexos_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'oryagro-attachments'
         and (storage.foldername(name))[1] = 'user'
         and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists anexos_storage_insert on storage.objects;
create policy anexos_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'oryagro-attachments'
              and (storage.foldername(name))[1] = 'user'
              and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists anexos_storage_delete on storage.objects;
create policy anexos_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'oryagro-attachments'
         and (storage.foldername(name))[1] = 'user'
         and (storage.foldername(name))[2] = auth.uid()::text);
