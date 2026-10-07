import { describe, it, expect, vi } from 'vitest';

// As funções testadas são puras; o resto do módulo fala com o Supabase.
vi.mock('../lib/supabase', () => ({ supabase: {}, getUserId: async () => null }));
vi.mock('../lib/logger', () => ({ logDbError: () => {} }));
vi.mock('../lib/outbox', () => ({ insertOfflineSafe: vi.fn(), updateOfflineSafe: vi.fn(), deleteOfflineSafe: vi.fn(), pendentes: () => [] }));

const { qtdNaUnidadeDoEstoque, gerarDatas, resumoAgendados, getCategoria, linhaDoRegistro } = await import('./useAtividades');

describe('qtdNaUnidadeDoEstoque — baixa no estoque na unidade certa', () => {
  it('mesma unidade passa direto', () => {
    expect(qtdNaUnidadeDoEstoque(25, 'kg', 'kg')).toBe(25);
    expect(qtdNaUnidadeDoEstoque('2,5', 'L', 'L')).toBe(2.5);
  });
  it('converte g→kg e mL→L (dose de rega em item comprado por saco/galão)', () => {
    expect(qtdNaUnidadeDoEstoque(25, 'g', 'kg')).toBe(0.025);
    expect(qtdNaUnidadeDoEstoque(15, 'mL', 'L')).toBe(0.015);
    expect(qtdNaUnidadeDoEstoque(2, 'kg', 'g')).toBe(2000);
  });
  it('ignora maiúsculas/espaços na unidade', () => {
    expect(qtdNaUnidadeDoEstoque(500, ' G ', 'KG')).toBe(0.5);
    expect(qtdNaUnidadeDoEstoque(30, 'ml', 'l')).toBe(0.03);
  });
  it('unidades incompatíveis → null (não dá baixa errada)', () => {
    expect(qtdNaUnidadeDoEstoque(25, 'g', 'L')).toBeNull();
    expect(qtdNaUnidadeDoEstoque(3, 'un', 'kg')).toBeNull();
  });
  it('quantidade vazia, zero ou inválida → null', () => {
    expect(qtdNaUnidadeDoEstoque('', 'g', 'kg')).toBeNull();
    expect(qtdNaUnidadeDoEstoque(0, 'g', 'kg')).toBeNull();
    expect(qtdNaUnidadeDoEstoque('abc', 'g', 'kg')).toBeNull();
    expect(qtdNaUnidadeDoEstoque(null, 'g', 'kg')).toBeNull();
  });
  it('sem unidade no lançamento assume a do estoque', () => {
    expect(qtdNaUnidadeDoEstoque(4, '', 'kg')).toBe(4);
  });
});

describe('gerarDatas — repetição "a cada N dias até…"', () => {
  it('sem repetição devolve só a data inicial', () => {
    expect(gerarDatas('2026-09-02')).toEqual(['2026-09-02']);
    expect(gerarDatas('2026-09-02', { intervaloDias: 7 })).toEqual(['2026-09-02']);
  });
  it('toda quarta-feira de setembro', () => {
    expect(gerarDatas('2026-09-02', { intervaloDias: 7, ate: '2026-09-30' }))
      .toEqual(['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30']);
  });
  it('atravessa a virada do mês', () => {
    expect(gerarDatas('2026-01-28', { intervaloDias: 3, ate: '2026-02-04' }))
      .toEqual(['2026-01-28', '2026-01-31', '2026-02-03']);
  });
  it('data final antes da inicial → só a inicial', () => {
    expect(gerarDatas('2026-09-10', { intervaloDias: 7, ate: '2026-09-01' })).toEqual(['2026-09-10']);
  });
  it('limita a 60 ocorrências', () => {
    expect(gerarDatas('2026-01-01', { intervaloDias: 1, ate: '2027-12-31' })).toHaveLength(60);
  });
  it('sem data inicial → nada', () => {
    expect(gerarDatas('')).toEqual([]);
  });
});

describe('resumoAgendados', () => {
  const ag = (id, d) => ({ id, status: 'agendado', data_prevista: d });
  it('separa atrasados, hoje, amanhã e próximo; ignora realizados', () => {
    const r = resumoAgendados([
      ag('a', '2026-10-01'), ag('b', '2026-10-06'), ag('c', '2026-10-07'), ag('d', '2026-10-20'),
      { id: 'e', status: 'feito', data_execucao: '2026-10-06' },
    ], '2026-10-06');
    expect(r.atrasadas).toBe(1);
    expect(r.hoje.id).toBe('b');
    expect(r.amanha.id).toBe('c');
    expect(r.proxima.id).toBe('d');
    expect(r.agendados).toHaveLength(4);
  });
});

describe('getCategoria', () => {
  it('categoria desconhecida cai em "Outros"', () => {
    expect(getCategoria('xyz').value).toBe('outros');
    expect(getCategoria(null).value).toBe('outros');
  });
  it('anotação existe e não usa insumo', () => {
    expect(getCategoria('anotacao').usaInsumo).toBe(false);
  });
});

describe('linhaDoRegistro — formulário do Anotar → colunas do banco', () => {
  const base = { categoria: 'adubacao_solo', etapa: '', produto: 'Sulfato', insumoId: 'i1', quantidade: '25', unidade: 'g', observacao: '', data: '2026-10-07' };
  it('realizado: data de execução, status feito, título = produto', () => {
    expect(linhaDoRegistro({ ...base, agendado: false })).toMatchObject({
      etapa: 'Sulfato', status: 'feito', data_execucao: '2026-10-07', data_prevista: null,
      quantidade: 25, unidade: 'g', insumo_id: 'i1', tipo: 'adubo',
    });
  });
  it('agendado: data prevista', () => {
    expect(linhaDoRegistro({ ...base, agendado: true })).toMatchObject({
      status: 'agendado', data_prevista: '2026-10-07', data_execucao: null,
    });
  });
  it('quantidade com vírgula; sem quantidade não grava unidade', () => {
    expect(linhaDoRegistro({ ...base, quantidade: '2,5' }).quantidade).toBe(2.5);
    expect(linhaDoRegistro({ ...base, quantidade: '' })).toMatchObject({ quantidade: null, unidade: null });
  });
  it('sem título nem produto usa o nome da categoria', () => {
    expect(linhaDoRegistro({ ...base, produto: '', categoria: 'poda' }).etapa).toBe('Poda / condução');
  });
});
