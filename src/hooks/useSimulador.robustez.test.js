/**
 * Robustez do motor do simulador contra TODAS as culturas cadastradas.
 *
 * Motivação (auditoria 2026-07): um guard frágil fazia `sobrevivencia` virar NaN
 * quando o campo não era passado (`parseFloat(undefined) != null` é true), o que
 * contaminava produção/receita/lucro em silêncio. Estes testes garantem que
 * nenhum resultado vire NaN/Infinity — nem com campos vazios, nem degenerados.
 */
import { describe, it, expect, vi } from 'vitest';

// O hook só usa useMemo — executamos a fábrica direto para testá-lo como função pura.
vi.mock('react', () => ({ useMemo: (fn) => fn() }));

const { useSimulador, calcularPlantas } = await import('./useSimulador');
const { CULTURAS_LIST } = await import('../data/culturas');

/** Campos numéricos que nunca podem ser NaN/Infinity. */
const NUMERICOS = ['custoTotal', 'receita', 'lucro', 'margem', 'producaoTotal',
  'totalPlantas', 'plantasViaveis', 'custoPlanta', 'escala'];

function checarFinitos(r, contexto) {
  for (const k of NUMERICOS) {
    const v = r[k];
    if (v == null) continue; // ausente é aceitável; NaN não é
    expect(Number.isFinite(v), `${contexto}: ${k} = ${v}`).toBe(true);
  }
  for (const c of r.composicaoCustos || []) {
    expect(Number.isFinite(c.value), `${contexto}: custo ${c.name} = ${c.value}`).toBe(true);
  }
}

describe('useSimulador — robustez em todas as culturas', () => {
  it('não produz NaN/Infinity com valores vazios (usa padrões da cultura)', () => {
    for (const cultura of CULTURAS_LIST) {
      checarFinitos(useSimulador(cultura, {}), `${cultura.id} (vazio)`);
    }
  });

  it('não produz NaN/Infinity com strings vazias nos campos', () => {
    const vazios = {
      areaHa: '', comprimento: '', largura: '', espacamentoLinhas: '', espacamentoPlantas: '',
      precoVenda: '', sobrevivencia: '', modObra: '', calcareo: '', esterco: '', npk: '',
      ureia: '', nitratoCalcio: '', numLinhas: '', espEstaca: '', valorEstaca: '',
      arameKg: '', precoArame: '',
    };
    for (const cultura of CULTURAS_LIST) {
      checarFinitos(useSimulador(cultura, vazios), `${cultura.id} (strings vazias)`);
    }
  });

  it('não quebra com zeros (espaçamento/área degenerados)', () => {
    const zeros = { areaHa: 0, comprimento: 0, largura: 0, espacamentoLinhas: 0, espacamentoPlantas: 0, numLinhas: 0 };
    for (const cultura of CULTURAS_LIST) {
      checarFinitos(useSimulador(cultura, zeros), `${cultura.id} (zeros)`);
    }
  });

  it('escala a produção com a área (2 ha rende ~2× de 1 ha)', () => {
    const campo = CULTURAS_LIST.filter(c => c.tipo === 'campo' && c.venda?.producaoKgPorHa);
    expect(campo.length).toBeGreaterThan(0);
    for (const c of campo) {
      const a = useSimulador(c, { areaHa: 1 });
      const b = useSimulador(c, { areaHa: 2 });
      expect(b.producaoTotal / a.producaoTotal, `${c.id}`).toBeCloseTo(2, 1);
      expect(b.receita, `${c.id}`).toBeGreaterThan(a.receita);
    }
  });

  it('sobrevivência menor reduz a produção', () => {
    for (const c of CULTURAS_LIST) {
      const cheia = useSimulador(c, { sobrevivencia: 100 });
      const meia  = useSimulador(c, { sobrevivencia: 50 });
      expect(meia.producaoTotal, `${c.id}`).toBeLessThanOrEqual(cheia.producaoTotal);
      expect(Number.isFinite(meia.producaoTotal), `${c.id}`).toBe(true);
    }
  });

  it('culturas com espaldeira cobram estacas e arame; as demais não', () => {
    const comEspaldeira = CULTURAS_LIST.filter(c => c.espaldeira);
    expect(comEspaldeira.length).toBeGreaterThan(0);
    for (const c of comEspaldeira) {
      const r = useSimulador(c, {});
      expect(r.custoEstacas, `${c.id} estacas`).toBeGreaterThan(0);
      if (c.insumos?.arame) expect(r.custoArame, `${c.id} arame`).toBeGreaterThan(0);
    }
    for (const c of CULTURAS_LIST.filter(x => !x.espaldeira)) {
      const r = useSimulador(c, {});
      expect(r.custoEstacas, `${c.id}`).toBe(0);
      expect(r.custoArame, `${c.id}`).toBe(0);
    }
  });

  it('calcularPlantas devolve números finitos e não-negativos para toda cultura', () => {
    for (const c of CULTURAS_LIST) {
      const d = calcularPlantas(c, {});
      expect(Number.isFinite(d.totalPlantas), `${c.id}`).toBe(true);
      expect(d.totalPlantas, `${c.id}`).toBeGreaterThanOrEqual(0);
    }
  });
});
