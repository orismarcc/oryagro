import { describe, it, expect } from 'vitest';
import {
  numero, dividirIgual, valorProporcional, somar, diferenca, rateioInicial, redistribuir, pendenciasPorPessoa,
} from './rateio';

describe('numero', () => {
  it('aceita vírgula e milhar', () => {
    expect(numero('1.234,56')).toBe(1234.56);
    expect(numero('146,67')).toBe(146.67);
    expect(numero('7.5')).toBe(7.5);
    expect(Number.isNaN(numero(''))).toBe(true);
  });
});

describe('dividirIgual', () => {
  it('fecha exatamente com o total', () => {
    expect(dividirIgual(440, 3)).toEqual([146.67, 146.67, 146.66]);
    expect(dividirIgual(450, 3)).toEqual([150, 150, 150]);
    expect(somar(dividirIgual(100, 3))).toBe(100);
  });
  it('sem membros → vazio', () => {
    expect(dividirIgual(100, 0)).toEqual([]);
  });
});

describe('valorProporcional', () => {
  it('2 t de 15 t a R$ 1.800', () => {
    expect(valorProporcional('2', 15, 1800)).toBe(240);
    expect(valorProporcional('7,5', 15, 1800)).toBe(900);
  });
  it('dados inválidos → null', () => {
    expect(valorProporcional('', 15, 1800)).toBeNull();
    expect(valorProporcional(2, 0, 1800)).toBeNull();
  });
});

describe('diferenca', () => {
  it('0 quando as partes fecham', () => {
    expect(diferenca(900, [600, 300])).toBe(0);
    expect(diferenca(900, [600, 250])).toBe(50);
  });
});

describe('rateioInicial', () => {
  const membros = [{ id: 'h', nome: 'Heriel' }, { id: 'o', nome: 'Ori' }, { id: 'p', nome: 'Orismar' }];
  it('sem pagador: todos pagaram a sua parte', () => {
    const r = rateioInicial(membros, 450);
    expect(r.map(l => l.valor)).toEqual([150, 150, 150]);
    expect(r.every(l => l.status === 'pago')).toBe(true);
  });
  it('com pagador: os outros ficam pendentes', () => {
    const r = rateioInicial(membros, 450, 'h');
    expect(r.map(l => l.status)).toEqual(['pago', 'pendente', 'pendente']);
  });
});

describe('redistribuir', () => {
  it('mantém a parte editada e divide o resto', () => {
    const linhas = [{ membroId: 'h', valor: 600 }, { membroId: 'p', valor: 0 }, { membroId: 'o', valor: 0 }];
    const r = redistribuir(linhas, 900, new Set(['h']));
    expect(r.map(l => l.valor)).toEqual([600, 150, 150]);
  });
});

describe('pendenciasPorPessoa', () => {
  it('soma só as pendentes, por pessoa', () => {
    const r = pendenciasPorPessoa([
      { membro_id: 'a', valor: 146.67, status: 'pendente', membro: { nome: 'Ori' } },
      { membro_id: 'a', valor: 150, status: 'pendente', membro: { nome: 'Ori' } },
      { membro_id: 'b', valor: 150, status: 'pago', membro: { nome: 'Heriel' } },
    ]);
    expect(r).toEqual([{ membroId: 'a', nome: 'Ori', total: 296.67, itens: 2 }]);
  });
});
