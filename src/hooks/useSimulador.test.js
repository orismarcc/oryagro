import { describe, it, expect } from 'vitest';
import { calcularPlantas } from './useSimulador';

const culturaCampo = {
  tipo: 'campo',
  area: { padrao: 1 },
  espacamento: { linhas: 4, plantas: 4 },
};

const culturaCanteiro = {
  tipo: 'canteiro',
  canteiro: { comprimento: 10, largura: 1, espacamentoLinhas: 0.25, espacamentoPlantas: 0.25 },
};

describe('calcularPlantas', () => {
  it('campo: plantas/ha = 10000/(L*P) × área', () => {
    const r = calcularPlantas(culturaCampo, { areaHa: 1, espacamentoLinhas: 4, espacamentoPlantas: 4 });
    expect(r.plantasPorHa).toBe(625);   // 10000 / (4*4)
    expect(r.totalPlantas).toBe(625);   // × 1 ha
  });

  it('campo: área maior escala o total', () => {
    const r = calcularPlantas(culturaCampo, { areaHa: 0.5, espacamentoLinhas: 4, espacamentoPlantas: 3 });
    expect(r.plantasPorHa).toBe(833);   // floor(10000/12)
    expect(r.totalPlantas).toBe(417);   // round(833 * 0.5)
  });

  it('canteiro: linhas × plantas por linha', () => {
    const r = calcularPlantas(culturaCanteiro, {
      comprimento: 10, largura: 1, espacamentoLinhas: 0.25, espacamentoPlantas: 0.25,
    });
    expect(r.linhas).toBe(4);      // floor(1 / 0.25)
    expect(r.porLinha).toBe(40);   // floor(10 / 0.25)
    expect(r.totalPlantas).toBe(160);
  });

  it('valores inválidos/vazios caem nos defaults da cultura (sem NaN/crash)', () => {
    // parseFloat(x) || default → valores 0/''/inválidos usam o padrão da cultura
    const r = calcularPlantas(culturaCampo, { areaHa: '', espacamentoLinhas: '', espacamentoPlantas: '' });
    expect(r.plantasPorHa).toBe(625);            // usa espacamento.padrão 4×4
    expect(Number.isNaN(r.totalPlantas)).toBe(false);
    expect(r.totalPlantas).toBeGreaterThan(0);
  });
});
