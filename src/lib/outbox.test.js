import { describe, it, expect } from 'vitest';
import { isErroDeRede, clientUuid } from './outbox';

/**
 * A fila offline precisa distinguir FALHA DE REDE (reenviar depois) de ERRO DE
 * REGRA do banco (falhar de verdade). Enfileirar um erro de constraint/RLS faria
 * o app retentar para sempre; não enfileirar uma falha de rede perde o dado do
 * produtor em campo — que é o caso comum com sinal fraco.
 */
describe('isErroDeRede', () => {
  it('trata falhas de rede como reenviáveis', () => {
    expect(isErroDeRede({ message: 'Failed to fetch' })).toBe(true);
    expect(isErroDeRede({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isErroDeRede({ message: 'network request failed' })).toBe(true);
    expect(isErroDeRede({ message: 'Load failed' })).toBe(true);
    expect(isErroDeRede({ name: 'TypeError', message: '' })).toBe(true);
  });

  it('NÃO enfileira erros de regra do banco (têm code)', () => {
    expect(isErroDeRede({ code: '23505', message: 'duplicate key' })).toBe(false);   // unique
    expect(isErroDeRede({ code: '23502', message: 'null value' })).toBe(false);      // not null
    expect(isErroDeRede({ code: '42501', message: 'permission denied' })).toBe(false); // RLS
    expect(isErroDeRede({ code: 'PGRST116', message: 'no rows' })).toBe(false);
  });

  it('lida com entradas vazias', () => {
    expect(isErroDeRede(null)).toBe(false);
    expect(isErroDeRede(undefined)).toBe(false);
    expect(isErroDeRede({})).toBe(false);
  });
});

describe('clientUuid', () => {
  it('gera ids únicos no formato UUID v4', () => {
    const a = clientUuid(), b = clientUuid();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
