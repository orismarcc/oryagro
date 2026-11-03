-- ════════════════════════════════════════════════════════════════════════════
-- Usuários por LOTE (não só pela propriedade inteira).
--  - lote_membros.participa_rateio: sócio (divide as despesas) ou só acesso.
--  - Quem tem acesso a um lote de um talhão perene enxerga o talhão dele
--    (sem isso a página da propriedade não mostrava o lote).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.lote_membros
  add column if not exists participa_rateio boolean not null default true;

drop policy if exists talhoes_lote_membro_ler on public.talhoes;
create policy talhoes_lote_membro_ler on public.talhoes for select
  using (exists (select 1 from public.plantios p
                 where p.talhao_id = talhoes.id and public.is_lote_membro(p.id)));
