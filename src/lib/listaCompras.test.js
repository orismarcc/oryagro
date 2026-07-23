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

describe('computeListaCompras', () => {
  // Cultura real: 'quiabo' tem etapas com "Ureia 46%" a 40 kg/ha nos dias 15/30/45.
  const hoje = new Date('2026-07-23T12:00:00');
  const loteQuiabo = {
    id: 'l1', nome: 'Quiabo A', cultura_id: 'quiabo',
    data_plantio: '2026-07-20', area_ha: 2, total_plantas: 0,
  };

  it('projeta necessidade a partir do cronograma dentro do horizonte', () => {
    const { itens } = computeListaCompras({
      lotes: [loteQuiabo], estoque: [], horizonteDias: 40, hoje,
    });
    const ureia = itens.find(i => /ureia/i.test(i.produto));
    expect(ureia).toBeTruthy();
    // dias 15,30 caem em [0,40] a partir de 20/07 → 04/08 e 19/08; dia 45 = 03/09 (fora de 40d? 20/07+40=29/08) → só 2 aplicações
    // 2 x (40 kg/ha x 2 ha) = 160 kg
    expect(ureia.unidade).toBe('kg');
    expect(ureia.comprar).toBe(160);
  });

  it('desconta o estoque disponível (mesma unidade)', () => {
    const { itens } = computeListaCompras({
      lotes: [loteQuiabo],
      estoque: [{ id: 'e1', nome: 'Ureia', unidade: 'kg', quantidade: 100 }],
      horizonteDias: 40, hoje,
    });
    const ureia = itens.find(i => /ureia/i.test(i.produto));
    expect(ureia.comprar).toBe(60); // 160 - 100
    expect(ureia.temNoEstoque).toBe(true);
  });

  it('não lista o produto quando o estoque já cobre a necessidade', () => {
    const { itens } = computeListaCompras({
      lotes: [loteQuiabo],
      estoque: [{ id: 'e1', nome: 'Ureia', unidade: 'kg', quantidade: 500 }],
      horizonteDias: 40, hoje,
    });
    expect(itens.find(i => /ureia/i.test(i.produto))).toBeFalsy();
  });

  it('marca conflito de unidade em vez de subtrair errado', () => {
    const { itens } = computeListaCompras({
      lotes: [loteQuiabo],
      estoque: [{ id: 'e1', nome: 'Ureia', unidade: 'L', quantidade: 999 }],
      horizonteDias: 40, hoje,
    });
    const ureia = itens.find(i => /ureia/i.test(i.produto));
    expect(ureia).toBeTruthy();          // não abateu litros de kg
    expect(ureia.unidadeConflito).toBe(true);
    expect(ureia.comprar).toBe(160);
  });

  it('coloca doses por calda em "incertos" sem inventar quantidade', () => {
    const { incertos } = computeListaCompras({
      lotes: [loteQuiabo], estoque: [], horizonteDias: 60, hoje,
    });
    // quiabo tem foliares por L (Aminoácidos 2mL/L, Nitrato de Cálcio 5g/L)
    expect(incertos.length).toBeGreaterThan(0);
    expect(incertos.every(i => !('comprar' in i))).toBe(true);
  });

  it('ignora lotes sem data de plantio ou cultura desconhecida', () => {
    const { itens, incertos } = computeListaCompras({
      lotes: [{ id: 'x', cultura_id: 'inexistente', data_plantio: '2026-07-20' },
              { id: 'y', cultura_id: 'quiabo', data_plantio: null }],
      estoque: [], horizonteDias: 40, hoje,
    });
    expect(itens).toEqual([]);
    expect(incertos).toEqual([]);
  });
});
