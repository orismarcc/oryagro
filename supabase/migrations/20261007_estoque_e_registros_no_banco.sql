-- ════════════════════════════════════════════════════════════════════════════
-- Estoque, colheita e despesas sincronizados NO BANCO (gatilhos).
--
-- Por quê: o app passou a gravar registros também sem sinal (fila offline).
-- Para o estoque nunca dobrar nem se perder num reenvio, a regra fica aqui:
--   • saldo do insumo = efeito das movimentações (insert/delete/update);
--   • registro "feito" com produto do estoque  → saída automática (com
--     conversão g→kg, mL→L); reabrir/editar/excluir refaz ou estorna;
--   • registro de COLHEITA feito com quantidade → produção do lote;
--   • despesa com entrada no estoque: editar ajusta, excluir estorna;
--   • estoque mínimo padrão de 25% (ou valor fixo) recalculado sozinho.
-- Compatível com versões antigas do app: as RPCs antigas continuam existindo.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Conversão de unidade (espelha qtdNaUnidadeDoEstoque do app) ─────────────
create or replace function public.fn_qtd_na_unidade(p_qtd numeric, p_de text, p_para text)
returns numeric language sql immutable as $$
  select case
    when p_qtd is null or p_qtd <= 0 then null
    when nullif(trim(p_para), '') is null then p_qtd
    when coalesce(nullif(lower(trim(p_de)), ''), lower(trim(p_para))) = lower(trim(p_para)) then p_qtd
    else case lower(trim(p_de)) || '>' || lower(trim(p_para))
      when 'g>kg'   then p_qtd / 1000  when 'kg>g'   then p_qtd * 1000
      when 'ml>l'   then p_qtd / 1000  when 'l>ml'   then p_qtd * 1000
      when 'kg>t'   then p_qtd / 1000  when 't>kg'   then p_qtd * 1000
      when 'kg>ton' then p_qtd / 1000  when 'ton>kg' then p_qtd * 1000
      when 't>ton'  then p_qtd         when 'ton>t'  then p_qtd
      else null end
  end
$$;

-- 2. Estoque mínimo: 25% do nível de referência (ou valor fixo) ──────────────
alter table public.estoque_insumos
  add column if not exists minimo_tipo text not null default 'percent',
  add column if not exists minimo_percentual numeric not null default 25,
  add column if not exists quantidade_referencia numeric;

do $$ begin
  alter table public.estoque_insumos add constraint estoque_insumos_minimo_tipo_check
    check (minimo_tipo in ('percent', 'valor'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.estoque_insumos add constraint estoque_insumos_minimo_percentual_check
    check (minimo_percentual >= 0 and minimo_percentual <= 100);
exception when duplicate_object then null; end $$;

-- Referência = nível após a última compra/entrada (ou o maior nível visto).
create or replace function public.tg_estoque_insumos_minimo()
returns trigger language plpgsql as $$
begin
  if NEW.quantidade_referencia is null or NEW.quantidade > NEW.quantidade_referencia then
    NEW.quantidade_referencia := greatest(coalesce(NEW.quantidade, 0), 0);
  end if;
  if NEW.minimo_tipo = 'percent' then
    NEW.quantidade_minima := round(NEW.quantidade_referencia * NEW.minimo_percentual / 100.0, 3);
  end if;
  return NEW;
end $$;

drop trigger if exists trg_estoque_insumos_minimo on public.estoque_insumos;
create trigger trg_estoque_insumos_minimo
  before insert or update on public.estoque_insumos
  for each row execute function public.tg_estoque_insumos_minimo();

-- 3. Saldo mantido pelas movimentações ──────────────────────────────────────
create or replace function public.tg_estoque_movimentos_saldo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP in ('DELETE', 'UPDATE') then
    if OLD.tipo = 'entrada' then
      -- desfaz a compra: o "cheio" de referência também volta
      update public.estoque_insumos
         set quantidade = quantidade - OLD.quantidade,
             quantidade_referencia = greatest(coalesce(quantidade_referencia, 0) - OLD.quantidade, quantidade - OLD.quantidade, 0),
             updated_at = now()
       where id = OLD.insumo_id;
    else
      update public.estoque_insumos
         set quantidade = quantidade + OLD.quantidade, updated_at = now()
       where id = OLD.insumo_id;
    end if;
  end if;
  if TG_OP in ('INSERT', 'UPDATE') then
    if NEW.tipo = 'entrada' then
      update public.estoque_insumos
         set quantidade = quantidade + NEW.quantidade,
             quantidade_referencia = quantidade + NEW.quantidade,  -- nova compra = novo "cheio"
             updated_at = now()
       where id = NEW.insumo_id;
    else
      update public.estoque_insumos
         set quantidade = quantidade - NEW.quantidade, updated_at = now()
       where id = NEW.insumo_id;
    end if;
  end if;
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists trg_estoque_movimentos_saldo on public.estoque_movimentos;
create trigger trg_estoque_movimentos_saldo
  after insert or delete or update of quantidade, tipo, insumo_id on public.estoque_movimentos
  for each row execute function public.tg_estoque_movimentos_saldo();

-- Um registro do cronograma gera no máximo UMA saída (protege contra reenvio).
create unique index if not exists estoque_movimentos_atividade_unica
  on public.estoque_movimentos (cronograma_atividade_id) where cronograma_atividade_id is not null;

-- RPCs antigas: mantidas para versões antigas do app, agora sem mexer no saldo
-- (o gatilho já faz) — evita contar duas vezes.
create or replace function public.adjust_insumo_quantidade(p_insumo_id uuid, p_delta numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Saldo mantido por trg_estoque_movimentos_saldo. Mantida só por compatibilidade.
  return;
end $$;

create or replace function public.delete_movimento_with_balance(p_movimento_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.estoque_movimentos where id = p_movimento_id;
  if not found then return false; end if;
  if v_user <> auth.uid() then
    raise exception 'Não autorizado a excluir movimento de outro usuário';
  end if;
  delete from public.estoque_movimentos where id = p_movimento_id;  -- gatilho estorna o saldo
  return true;
end $$;

-- 4. Registro do cronograma → saída do estoque + produção (colheita) ─────────
alter table public.producao_registros
  add column if not exists atividade_id uuid references public.cronograma_atividades(id) on delete cascade;
create unique index if not exists producao_registros_atividade_unica
  on public.producao_registros (atividade_id) where atividade_id is not null;

create or replace function public.tg_atividade_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ins   record;
  v_qtd   numeric;
  v_dono  uuid;
begin
  if TG_OP = 'DELETE' then
    delete from public.estoque_movimentos where cronograma_atividade_id = OLD.id;  -- estorna
    return OLD;
  end if;

  if TG_OP = 'UPDATE'
     and NEW.status        is not distinct from OLD.status
     and NEW.insumo_id     is not distinct from OLD.insumo_id
     and NEW.quantidade    is not distinct from OLD.quantidade
     and NEW.unidade       is not distinct from OLD.unidade
     and NEW.data_execucao is not distinct from OLD.data_execucao
     and NEW.categoria     is not distinct from OLD.categoria
     and NEW.plantio_id    is not distinct from OLD.plantio_id
     and NEW.etapa         is not distinct from OLD.etapa
     and NEW.observacao    is not distinct from OLD.observacao then
    return NEW;  -- nada que afete estoque/produção
  end if;

  -- Estoque: refaz a saída (estorna a anterior, baixa a atual se "feito")
  delete from public.estoque_movimentos where cronograma_atividade_id = NEW.id;
  if NEW.status = 'feito' and NEW.insumo_id is not null then
    select id, user_id, unidade into v_ins from public.estoque_insumos where id = NEW.insumo_id;
    if found then
      v_qtd := public.fn_qtd_na_unidade(NEW.quantidade, NEW.unidade, v_ins.unidade);
      if v_qtd is not null then
        insert into public.estoque_movimentos
          (user_id, insumo_id, tipo, quantidade, observacao, data, plantio_id, cronograma_atividade_id)
        values
          (v_ins.user_id, v_ins.id, 'saida', v_qtd, 'Cronograma: ' || NEW.etapa,
           coalesce(NEW.data_execucao, current_date), NEW.plantio_id, NEW.id);
      end if;
    end if;
  end if;

  -- Colheita: registro "feito" com quantidade vira produção do lote
  if NEW.categoria = 'colheita' and NEW.status = 'feito'
     and coalesce(NEW.quantidade, 0) > 0 and NEW.plantio_id is not null then
    select user_id into v_dono from public.plantios where id = NEW.plantio_id;
    insert into public.producao_registros
      (plantio_id, user_id, data, quantidade, unidade, observacao, atividade_id)
    values
      (NEW.plantio_id, v_dono, coalesce(NEW.data_execucao, current_date), NEW.quantidade,
       coalesce(nullif(trim(NEW.unidade), ''), 'kg'), nullif(trim(NEW.observacao), ''), NEW.id)
    on conflict (atividade_id) where atividade_id is not null do update
      set plantio_id = excluded.plantio_id, data = excluded.data, quantidade = excluded.quantidade,
          unidade = excluded.unidade, observacao = excluded.observacao, updated_at = now();
  else
    delete from public.producao_registros where atividade_id = NEW.id;
  end if;

  return NEW;
end $$;

drop trigger if exists trg_atividade_sync_iu on public.cronograma_atividades;
create trigger trg_atividade_sync_iu
  after insert or update on public.cronograma_atividades
  for each row execute function public.tg_atividade_sync();
-- BEFORE: precisa rodar antes do ON DELETE SET NULL da FK das movimentações
drop trigger if exists trg_atividade_sync_d on public.cronograma_atividades;
create trigger trg_atividade_sync_d
  before delete on public.cronograma_atividades
  for each row execute function public.tg_atividade_sync();

-- 5. Despesa com entrada no estoque: editar ajusta, excluir estorna ──────────
create or replace function public.tg_despesa_estoque()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_mov record; v_qtd numeric;
begin
  if TG_OP = 'DELETE' or (NEW.deleted_at is not null and OLD.deleted_at is null) then
    delete from public.estoque_movimentos where despesa_id = OLD.id;
    return coalesce(NEW, OLD);
  end if;
  if NEW.quantidade is not distinct from OLD.quantidade and NEW.unidade is not distinct from OLD.unidade
     and NEW.valor is not distinct from OLD.valor and NEW.data is not distinct from OLD.data then
    return NEW;
  end if;
  for v_mov in
    select m.id, i.unidade from public.estoque_movimentos m
    join public.estoque_insumos i on i.id = m.insumo_id
    where m.despesa_id = NEW.id and m.tipo = 'entrada'
  loop
    v_qtd := public.fn_qtd_na_unidade(NEW.quantidade, NEW.unidade, v_mov.unidade);
    if coalesce(NEW.quantidade, 0) <= 0 then
      delete from public.estoque_movimentos where id = v_mov.id;
    elsif v_qtd is not null then
      update public.estoque_movimentos
         set quantidade = v_qtd,
             data = NEW.data,
             preco_unitario_movimento = case when NEW.valor > 0 then NEW.valor / v_qtd else preco_unitario_movimento end
       where id = v_mov.id;
    end if;
  end loop;
  return NEW;
end $$;

drop trigger if exists trg_despesa_estoque_u on public.despesas;
create trigger trg_despesa_estoque_u
  after update on public.despesas
  for each row execute function public.tg_despesa_estoque();
drop trigger if exists trg_despesa_estoque_d on public.despesas;
create trigger trg_despesa_estoque_d
  before delete on public.despesas
  for each row execute function public.tg_despesa_estoque();

-- 6. Dados existentes: todos os insumos no padrão 25% ───────────────────────
update public.estoque_insumos i
   set minimo_tipo = 'percent',
       minimo_percentual = 25,
       quantidade_referencia = greatest(
         coalesce(i.quantidade, 0),
         coalesce((select m.quantidade from public.estoque_movimentos m
                    where m.insumo_id = i.id and m.tipo = 'entrada'
                    order by m.data desc, m.created_at desc limit 1), 0));
