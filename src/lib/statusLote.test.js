import { describe, it, expect } from 'vitest';
import { LOTE_STATUS, isLoteAtivo, isLoteFinalizado, isLoteConcluido } from './statusLote';

describe('statusLote', () => {
  it('isLoteAtivo: nulo e "ativo" são ativos', () => {
    expect(isLoteAtivo(null)).toBe(true);
    expect(isLoteAtivo(undefined)).toBe(true);
    expect(isLoteAtivo(LOTE_STATUS.ATIVO)).toBe(true);
    expect(isLoteAtivo(LOTE_STATUS.CONCLUIDO)).toBe(false);
  });

  it('isLoteFinalizado: encerrados de qualquer forma', () => {
    expect(isLoteFinalizado(LOTE_STATUS.COLHIDO)).toBe(true);
    expect(isLoteFinalizado(LOTE_STATUS.CONCLUIDO)).toBe(true);
    expect(isLoteFinalizado(LOTE_STATUS.PERDIDO)).toBe(true);
    expect(isLoteFinalizado(LOTE_STATUS.CANCELADO)).toBe(true);
    expect(isLoteFinalizado(LOTE_STATUS.ATIVO)).toBe(false);
    expect(isLoteFinalizado(null)).toBe(false);
  });

  it('isLoteConcluido: só sucesso (colhido/concluído/arquivado)', () => {
    expect(isLoteConcluido(LOTE_STATUS.CONCLUIDO)).toBe(true);
    expect(isLoteConcluido(LOTE_STATUS.COLHIDO)).toBe(true);
    expect(isLoteConcluido(LOTE_STATUS.ARQUIVADO)).toBe(true);
    expect(isLoteConcluido(LOTE_STATUS.PERDIDO)).toBe(false);
    expect(isLoteConcluido(LOTE_STATUS.CANCELADO)).toBe(false);
  });
});
