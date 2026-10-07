-- O cronograma do lote passou a aceitar lançamentos AGENDADOS (status 'agendado').
-- A restrição antiga só aceitava pendente/feito/atrasado/ignorado/removida, o que
-- fazia o botão "Agendar" falhar no banco.
alter table public.cronograma_atividades drop constraint if exists cronograma_atividades_status_check;
alter table public.cronograma_atividades add constraint cronograma_atividades_status_check
  check (status = any (array['pendente','feito','atrasado','ignorado','removida','agendado']));
