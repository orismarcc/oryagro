import { describe, it, expect } from 'vitest';
import { calcularManejoIrrigacao, kcCultura, laminaParaLitros } from './clima';

function prev(dias) {
  return {
    daily: {
      time: dias.map(d => d.data),
      et0: dias.map(d => d.et0),
      chuva: dias.map(d => d.chuva),
      tmax: dias.map(d => d.tmax ?? 30),
      tmin: dias.map(d => d.tmin ?? 18),
      probChuva: dias.map(d => d.prob ?? 0),
    },
  };
}

describe('calcularManejoIrrigacao', () => {
  const hojeISO = '2026-07-23';

  it('recomenda irrigar quando ETc > chuva', () => {
    const p = prev([
      { data: '2026-07-23', et0: 5, chuva: 0 },
      { data: '2026-07-24', et0: 5, chuva: 0 },
      { data: '2026-07-25', et0: 5, chuva: 0 },
    ]);
    const r = calcularManejoIrrigacao(p, { kc: 1.0, hojeISO });
    expect(r.recomendacao.nivel).toBe('irrigar');
    expect(r.dias[0].necessidade).toBe(5);          // 5*1 - 0
    expect(r.totalNecessidade7).toBe(15);
  });

  it('aplica o Kc na demanda', () => {
    const p = prev([{ data: '2026-07-23', et0: 4, chuva: 0 }]);
    const r = calcularManejoIrrigacao(p, { kc: 1.2, hojeISO });
    expect(r.dias[0].etc).toBe(4.8);
    expect(r.dias[0].necessidade).toBe(4.8);
  });

  it('manda segurar quando a chuva cobre a demanda', () => {
    const p = prev([
      { data: '2026-07-23', et0: 4, chuva: 20 },
      { data: '2026-07-24', et0: 4, chuva: 10 },
      { data: '2026-07-25', et0: 4, chuva: 10 },
    ]);
    const r = calcularManejoIrrigacao(p, { kc: 1.0, hojeISO });
    expect(r.recomendacao.nivel).toBe('segurar');
    expect(r.dias[0].necessidade).toBe(0);          // chuva > ETc
  });

  it('marca dias passados como não-futuros e não os conta nos totais', () => {
    const p = prev([
      { data: '2026-07-21', et0: 9, chuva: 0 },     // passado
      { data: '2026-07-23', et0: 5, chuva: 0 },     // hoje
    ]);
    const r = calcularManejoIrrigacao(p, { kc: 1.0, hojeISO });
    expect(r.dias.find(d => d.data === '2026-07-21').futuro).toBe(false);
    expect(r.totalNecessidade7).toBe(5);            // só hoje conta
  });

  it('lida com previsão vazia sem quebrar', () => {
    const r = calcularManejoIrrigacao({ daily: { time: [] } }, {});
    expect(r.dias).toEqual([]);
    expect(r.recomendacao).toBeNull();
  });
});

describe('kcCultura e laminaParaLitros', () => {
  it('retorna Kc conhecido e default 1.0', () => {
    expect(kcCultura('milho')).toBe(1.2);
    expect(kcCultura('desconhecida')).toBe(1.0);
  });
  it('converte lâmina em litros (1 mm = 10.000 L/ha)', () => {
    expect(laminaParaLitros(5, 2)).toBe(100_000);   // 5 mm × 2 ha
    expect(laminaParaLitros(0, 5)).toBe(0);
    expect(laminaParaLitros(5, 0)).toBe(0);
  });
});
