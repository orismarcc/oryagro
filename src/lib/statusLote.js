/**
 * statusLote.js — vocabulário canônico de status de um plantio/lote/safra.
 *
 * Antes os status estavam espalhados como strings soltas em vários componentes
 * ('concluido', 'colhido', 'arquivado', 'ativo'…), o que causou bugs de
 * inconsistência (ver migration 20260606_plantios_status_concluido).
 * Centralize aqui e use os helpers para evitar a próxima divergência.
 *
 * Deve estar alinhado ao CHECK do banco em public.plantios.status.
 */

export const LOTE_STATUS = {
  ATIVO:     'ativo',
  COLHIDO:   'colhido',
  CONCLUIDO: 'concluido',
  ARQUIVADO: 'arquivado',
  PERDIDO:   'perdido',
  CANCELADO: 'cancelado',
};

// Status que representam um ciclo encerrado (não está mais em andamento)
const FINALIZADOS = new Set([
  LOTE_STATUS.COLHIDO,
  LOTE_STATUS.CONCLUIDO,
  LOTE_STATUS.ARQUIVADO,
  LOTE_STATUS.PERDIDO,
  LOTE_STATUS.CANCELADO,
]);

/** Está em andamento? (status nulo é tratado como ativo) */
export function isLoteAtivo(status) {
  return !status || status === LOTE_STATUS.ATIVO;
}

/** Ciclo encerrado de qualquer forma (colhido/concluído/arquivado/perdido/cancelado)? */
export function isLoteFinalizado(status) {
  return FINALIZADOS.has(status);
}

/** Foi concluído com sucesso (colhido/concluído/arquivado)? */
export function isLoteConcluido(status) {
  return status === LOTE_STATUS.COLHIDO
    || status === LOTE_STATUS.CONCLUIDO
    || status === LOTE_STATUS.ARQUIVADO;
}
