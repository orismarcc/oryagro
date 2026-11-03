-- ════════════════════════════════════════════════════════════════════════════
-- Remove tabelas legadas sem uso (aprovado pelo dono em 03/11/2026).
--   plantio_eventos  → colheitas agora em producao_registros
--   diario_campo     → anotações agora em cronograma_atividades (categoria 'anotacao')
--   aplicacoes_campo → aplicações agora em cronograma_atividades (categoria 'defensivo'...)
--   receitas         → receitas agora em vendas (+ venda_parcelas)
-- Todas estavam vazias. O app não lê nem grava mais nelas (backups antigos
-- com eventos/diário são convertidos na importação — src/lib/backupExport.js).
-- ════════════════════════════════════════════════════════════════════════════

-- purge_soft_deleted citava receitas: recria sem ela
create or replace function public.purge_soft_deleted()
returns table(tabela text, removidos bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_n bigint;
begin
  delete from public.despesas where deleted_at is not null and deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; tabela := 'despesas'; removidos := v_n; return next;

  delete from public.vendas where deleted_at is not null and deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; tabela := 'vendas'; removidos := v_n; return next;

  delete from public.plantios where deleted_at is not null and deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; tabela := 'plantios'; removidos := v_n; return next;
end $$;

drop table if exists public.plantio_eventos;
drop table if exists public.diario_campo;
drop table if exists public.aplicacoes_campo;
drop table if exists public.receitas;   -- leva junto os gatilhos e a publicação realtime

drop function if exists public.set_receitas_updated_at();
