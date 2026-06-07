import { describe, it, expect } from 'vitest';
import { makeStableId, makeCustomId, buildStatusFromDbRows } from './useCronogramaSync';

describe('makeStableId', () => {
  it('gera slug estável e normalizado (acentos/espacos)', () => {
    expect(makeStableId('default', 'Adubação de Cobertura')).toBe('default_adubacao_de_cobertura');
    expect(makeStableId('viveiro', 'Semeadura em bandeja')).toBe('viveiro_semeadura_em_bandeja');
  });

  it('mesmo etapa → mesmo id (estável entre chamadas)', () => {
    expect(makeStableId('default', 'Colheita')).toBe(makeStableId('default', 'Colheita'));
  });

  it('prefixo diferencia viveiro de default', () => {
    expect(makeStableId('viveiro', 'X')).not.toBe(makeStableId('default', 'X'));
  });
});

describe('makeCustomId', () => {
  it('depende de etapa + dia', () => {
    const a = makeCustomId('Poda', 30);
    const b = makeCustomId('Poda', 45);
    expect(a).not.toBe(b);            // mesmo nome, dias diferentes → ids distintos
    expect(a).toBe(makeCustomId('Poda', 30)); // determinístico
    expect(a.startsWith('custom_')).toBe(true);
  });
});

describe('buildStatusFromDbRows', () => {
  it('converte linhas padrão em statusMap keyado por etapa', () => {
    const rows = [
      { etapa: 'Colheita', status: 'feito', data_execucao: '2026-05-01', is_custom: false, dia_previsto: 35 },
      { etapa: 'Adubação', status: 'removida', data_execucao: null, is_custom: false, dia_previsto: 7 },
    ];
    const { statusMap } = buildStatusFromDbRows(rows, []);
    expect(statusMap[makeStableId('default', 'Colheita')]).toEqual({ status: 'feito', data: '2026-05-01' });
    expect(statusMap[makeStableId('default', 'Adubação')].status).toBe('removida');
  });

  it('linhas custom viram customRows com _stableId', () => {
    const rows = [
      { etapa: 'Poda extra', status: 'pendente', data_execucao: null, is_custom: true, dia_previsto: 60, produto: 'X', dose: '1L', forma_aplicacao: 'foliar', tipo: 'manejo' },
    ];
    const { customRows } = buildStatusFromDbRows(rows, []);
    expect(customRows).toHaveLength(1);
    expect(customRows[0].etapa).toBe('Poda extra');
    expect(customRows[0]._stableId).toBe(makeCustomId('Poda extra', 60));
  });

  it('detecta etapa de viveiro pelo vivSteps (prefixo viveiro)', () => {
    const rows = [{ etapa: 'Semeadura', status: 'feito', data_execucao: '2026-01-01', is_custom: false, dia_previsto: 0 }];
    const { statusMap } = buildStatusFromDbRows(rows, [{ etapa: 'Semeadura' }]);
    expect(statusMap[makeStableId('viveiro', 'Semeadura')]).toBeDefined();
  });
});
