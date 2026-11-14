-- ════════════════════════════════════════════════════════════════════════════
-- Total de plantas do lote pelos TRANSPLANTES anotados.
--
-- Um registro `feito`, categoria `plantio`, com quantidade em `mudas` é um
-- transplante para o campo. Havendo pelo menos um, plantios.total_plantas passa
-- a ser a SOMA dos transplantes (o número planejado no cadastro deixa de valer);
-- o talhão perene da safra ativa acompanha. Tudo o que depende de plantas
-- (estimativa de produção, faturamento, doses por planta) se recalcula sozinho.
-- Editar, reabrir ou excluir um transplante refaz a soma. Sem nenhum transplante,
-- o total fica como está.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.fn_recalcula_plantas_transplante(p_plantio uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  v_talhao uuid;
  v_status text;
begin
  if p_plantio is null then return; end if;
  select sum(quantidade) into v_total
    from public.cronograma_atividades
   where plantio_id = p_plantio and status = 'feito' and categoria = 'plantio'
     and unidade = 'mudas' and quantidade > 0;
  if v_total is null then return; end if;

  update public.plantios set total_plantas = round(v_total)::int
   where id = p_plantio and total_plantas is distinct from round(v_total)::int
  returning talhao_id, status into v_talhao, v_status;

  if v_talhao is null then
    select talhao_id, status into v_talhao, v_status from public.plantios where id = p_plantio;
  end if;
  if v_talhao is not null and coalesce(v_status, 'ativo') = 'ativo' then
    update public.talhoes set total_plantas = round(v_total)::int
     where id = v_talhao and total_plantas is distinct from round(v_total)::int;
  end if;
end $$;

create or replace function public.tg_cronograma_transplante()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP <> 'INSERT' and OLD.categoria = 'plantio' and OLD.unidade = 'mudas' then
    perform public.fn_recalcula_plantas_transplante(OLD.plantio_id);
  end if;
  if TG_OP <> 'DELETE' and NEW.categoria = 'plantio' and NEW.unidade = 'mudas'
     and (TG_OP = 'INSERT' or OLD.plantio_id is distinct from NEW.plantio_id
          or OLD.categoria is distinct from 'plantio' or OLD.unidade is distinct from 'mudas'
          or OLD.status is distinct from NEW.status or OLD.quantidade is distinct from NEW.quantidade) then
    perform public.fn_recalcula_plantas_transplante(NEW.plantio_id);
  end if;
  return null;
end $$;

drop trigger if exists trg_cronograma_transplante on public.cronograma_atividades;
create trigger trg_cronograma_transplante
  after insert or update or delete on public.cronograma_atividades
  for each row execute function public.tg_cronograma_transplante();
