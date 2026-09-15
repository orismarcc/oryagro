import { describe, it, expect } from 'vitest';
import { parseDose, computeListaCompras, matchEstoque } from './listaCompras';

describe('matchEstoque (usado pelo cronograma E pelo caderno de campo)', () => {
  const estoque = [
    { id: 'a', nome: 'Ureia' },
    { id: 'b', nome: 'Nitrato de Cálcio' },
    { id: 'c', nome: 'Calcário Dolomítico' },
  ];
  it('casa nome exato e parcial', () => {
    expect(matchEstoque('Ureia', estoque).id).toBe('a');
    expect(matchEstoque('Ureia 46%', estoque).id).toBe('a');
  });
  it('ignora acentos e caixa', () => {
    expect(matchEstoque('NITRATO DE CALCIO', estoque).id).toBe('b');
    expect(matchEstoque('calcario dolomitico', estoque).id).toBe('c');
  });
  it('retorna null quando não há correspondência', () => {
    expect(matchEstoque('Glifosato', estoque)).toBeNull();
    expect(matchEstoque('', estoque)).toBeNull();
    expect(matchEstoque(null, estoque)).toBeNull();
  });
});

describe('parseDose', () => {
  it('interpreta dose por hectare (kg)', () => {
    expect(parseDose('40 kg/ha')).toEqual({ base: 'ha', valor: 40, unidade: 'kg' });
    expect(parseDose('40kg/ha')).toEqual({ base: 'ha', valor: 40, unidade: 'kg' });
  });
  it('interpreta L/ha e t/ha', () => {
    expect(parseDose('1,5 L/ha')).toEqual({ base: 'ha', valor: 1.5, unidade: 'L' });
    expect(parseDose('2 t/ha')).toEqual({ base: 'ha', valor: 2, unidade: 't' });
  });
  it('usa o maior valor em faixas (conservador)', () => {
    expect(parseDose('40-60 kg/ha')).toEqual({ base: 'ha', valor: 60, unidade: 'kg' });
  });
  it('dose por planta/cova', () => {
    expect(parseDose('2-3/cova').base).toBe('planta');
    expect(parseDose('2-3/cova').valor).toBe(3);
  });
  it('dose por litro de calda vira base calda (não totalizável)', () => {
    expect(parseDose('2mL/L')).toEqual({ base: 'calda', valor: 2, unidade: null });
    expect(parseDose('5g/L')).toEqual({ base: 'calda', valor: 5, unidade: null });
  });
  it('retorna null para dose vazia ou traço', () => {
    expect(parseDose('—')).toBeNull();
    expect(parseDose('')).toBeNull();
    expect(parseDose(null)).toBeNull();
  });
});

describe('computeListaCompras (a partir dos AGENDAMENTOS do produtor)', () => {
  const hoje  = new Date('2026-07-23T12:00:00');
  const lotes = [{ id: 'l1', nome: 'Quiabo A' }, { id: 'l2', nome: 'Melancia B' }];

  /** Agendamento de 80 kg de ureia daqui a 10 dias, no lote l1. */
  const ag = (over = {}) => ({
    id: 'a1', plantio_id: 'l1', status: 'agendado', data_prevista: '2026-08-02',
    produto: 'Ureia 46%', quantidade: 80, unidade: 'kg', ...over,
  });

  it('soma os agendamentos dentro do horizonte', () => {
    const { itens } = computeListaCompras({
      lotes, atividades: [ag(), ag({ id: 'a2', data_prevista: '2026-08-17' })],
      estoque: [], horizonteDias: 40, hoje,
    });
    const ureia = itens.find(i => /ureia/i.test(i.produto));
    expect(ureia.unidade).toBe('kg');
    expect(ureia.comprar).toBe(160);         // 80 + 80
    expect(ureia.lotes).toEqual(['Quiabo A']);
  });

  it('ignora agendamentos fora do horizonte e o que já foi realizado', () => {
    const { itens } = computeListaCompras({
      lotes,
      atividades: [
        ag({ id: 'a2', data_prevista: '2026-12-01' }),                       // muito longe
        ag({ id: 'a3', data_prevista: '2026-07-01' }),                       // passado
        ag({ id: 'a4', status: 'feito', data_execucao: '2026-07-22' }),      // já feito
      ],
      estoque: [], horizonteDias: 40, hoje,
    });
    expect(itens).toEqual([]);
  });

  it('desconta o estoque disponível (mesma unidade)', () => {
    const { itens } = computeListaCompras({
      lotes, atividades: [ag(), ag({ id: 'a2' })],
      estoque: [{ id: 'e1', nome: 'Ureia', unidade: 'kg', quantidade: 100 }],
      horizonteDias: 40, hoje,
    });
    const ureia = itens.find(i => /ureia/i.test(i.produto));
    expect(ureia.comprar).toBe(60);          // 160 - 100
    expect(ureia.temNoEstoque).toBe(true);
  });

  it('não lista o produto quando o estoque já cobre a necessidade', () => {
    const { itens } = computeListaCompras({
      lotes, atividades: [ag()],
      estoque: [{ id: 'e1', nome: 'Ureia', unidade: 'kg', quantidade: 500 }],
      horizonteDias: 40, hoje,
    });
    expect(itens.find(i => /ureia/i.test(i.produto))).toBeFalsy();
  });

  it('marca conflito de unidade em vez de subtrair errado', () => {
    const { itens } = computeListaCompras({
      lotes, atividades: [ag()],
      estoque: [{ id: 'e1', nome: 'Ureia', unidade: 'L', quantidade: 999 }],
      horizonteDias: 40, hoje,
    });
    const ureia = itens.find(i => /ureia/i.test(i.produto));
    expect(ureia.unidadeConflito).toBe(true);
    expect(ureia.comprar).toBe(80);
  });

  it('agendamento sem quantidade vai para "incertos" sem inventar número', () => {
    const { itens, incertos } = computeListaCompras({
      lotes, atividades: [ag({ quantidade: null, unidade: '' })],
      estoque: [], horizonteDias: 40, hoje,
    });
    expect(itens).toEqual([]);
    expect(incertos).toHaveLength(1);
    expect(incertos[0].produto).toBe('Ureia 46%');
    expect('comprar' in incertos[0]).toBe(false);
  });

  it('converte g→kg e mL→L para a unidade de compra', () => {
    const { itens } = computeListaCompras({
      lotes, atividades: [ag({ produto: 'Boro', quantidade: 2500, unidade: 'g' })],
      estoque: [], horizonteDias: 40, hoje,
    });
    const boro = itens.find(i => /boro/i.test(i.produto));
    expect(boro.unidade).toBe('kg');
    expect(boro.comprar).toBe(2.5);
  });

  it('ignora agendamentos de lotes fora da lista (filtro por propriedade)', () => {
    const { itens } = computeListaCompras({
      lotes: [{ id: 'l2', nome: 'Melancia B' }],
      atividades: [ag()],                    // pertence a l1
      estoque: [], horizonteDias: 40, hoje,
    });
    expect(itens).toEqual([]);
  });

  it('sem agendamentos não há nada a comprar', () => {
    const { itens, incertos } = computeListaCompras({
      lotes, atividades: [], estoque: [], horizonteDias: 40, hoje,
    });
    expect(itens).toEqual([]);
    expect(incertos).toEqual([]);
  });
});
